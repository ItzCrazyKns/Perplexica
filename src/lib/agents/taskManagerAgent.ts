import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { PromptTemplate } from '@langchain/core/prompts';
import { Command } from '@langchain/langgraph';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { taskBreakdownPrompt } from '../prompts/taskBreakdown';
import { AgentState } from './agentState';
import { setTemperature } from '../utils/modelUtils';
import { withStructuredOutput } from '../utils/structuredOutput';

// Define Zod schema for structured task breakdown output
const TaskBreakdownSchema = z.object({
  tasks: z
    .array(z.string())
    .describe(
      'Array of specific, focused tasks broken down from the original query',
    ),
  reasoning: z
    .string()
    .describe(
      'Explanation of how and why the query was broken down into these tasks',
    ),
});

type TaskBreakdown = z.infer<typeof TaskBreakdownSchema>;

export class TaskManagerAgent {
  private llm: BaseChatModel;
  private emitter: EventEmitter;
  private systemInstructions: string;
  private signal: AbortSignal;

  constructor(
    llm: BaseChatModel,
    emitter: EventEmitter,
    systemInstructions: string,
    signal: AbortSignal,
  ) {
    this.llm = llm;
    this.emitter = emitter;
    this.systemInstructions = systemInstructions;
    this.signal = signal;
  }

  /**
   * Task manager agent node - breaks down complex questions into smaller tasks
   */
  async execute(state: typeof AgentState.State): Promise<Command> {
    try {
      //setTemperature(this.llm, 0); // Set temperature to 0 for deterministic output

      // Check if we're in task progression mode (tasks already exist and we're processing them)
      if (state.tasks && state.tasks.length > 0) {
        const currentTaskIndex = state.currentTaskIndex || 0;
        const hasMoreTasks = currentTaskIndex < state.tasks.length - 1;

        if (hasMoreTasks) {
          // Move to next task
          const nextTaskIndex = currentTaskIndex + 1;
          this.emitter.emit('agent_action', {
            type: 'agent_action',
            data: {
              action: 'PROCEEDING_TO_NEXT_TASK',
              message: `Task ${currentTaskIndex + 1} completed. Moving to task ${nextTaskIndex + 1} of ${state.tasks.length}.`,
              details: {
                completedTask: state.tasks[currentTaskIndex],
                nextTask: state.tasks[nextTaskIndex],
                taskIndex: nextTaskIndex + 1,
                totalTasks: state.tasks.length,
                documentCount: state.relevantDocuments.length,
                query: state.originalQuery || state.query,
              },
            },
          });

          return new Command({
            goto: 'content_router',
            update: {
              // messages: [
              //   new AIMessage(
              //     `Task ${currentTaskIndex + 1} completed. Processing task ${nextTaskIndex + 1} of ${state.tasks.length}: "${state.tasks[nextTaskIndex]}"`,
              //   ),
              // ],
              currentTaskIndex: nextTaskIndex,
            },
          });
        } else {
          // All tasks completed, move to analysis
          this.emitter.emit('agent_action', {
            type: 'agent_action',
            data: {
              action: 'ALL_TASKS_COMPLETED',
              message: `All ${state.tasks.length} tasks completed. Ready for analysis.`,
              details: {
                totalTasks: state.tasks.length,
                documentCount: state.relevantDocuments.length,
                query: state.originalQuery || state.query,
              },
            },
          });

          return new Command({
            goto: 'analyzer',
            // update: {
            //   messages: [
            //     new AIMessage(
            //       `All ${state.tasks.length} tasks completed. Moving to analysis phase.`,
            //     ),
            //   ],
            // },
          });
        }
      }

      // Original task breakdown logic for new queries
      // Emit task analysis event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'ANALYZING_TASK_COMPLEXITY',
          message: `Analyzing question to determine if it needs to be broken down into smaller tasks`,
          details: {
            query: state.query,
            currentTasks: state.tasks?.length || 0,
          },
        },
      });

      const template = PromptTemplate.fromTemplate(taskBreakdownPrompt);

      // Create file context information
      const fileContext =
        state.fileIds && state.fileIds.length > 0
          ? `Files attached: ${state.fileIds.length} file(s) are available for analysis. Consider creating tasks that can leverage these attached files when appropriate.`
          : 'No files attached: Focus on tasks that can be answered through web research or general knowledge.';

      const prompt = await template.format({
        systemInstructions: this.systemInstructions,
        fileContext: fileContext,
        query: state.query,
      });

      // Use structured output for task breakdown
      const structuredLlm = withStructuredOutput(
        this.llm,
        TaskBreakdownSchema,
        {
          name: 'break_down_tasks',
        },
      );

      const taskBreakdownResult = (await structuredLlm.invoke([prompt], {
        signal: this.signal,
      })) as TaskBreakdown;

      console.log('Task breakdown response:', taskBreakdownResult);

      // Extract tasks from structured response
      const taskLines = taskBreakdownResult.tasks.filter(
        (task) => task.trim().length > 0,
      );

      if (taskLines.length === 0) {
        // Fallback: if no tasks found, use the original query
        taskLines.push(state.query);
      }

      console.log(
        `Task breakdown completed: ${taskLines.length} tasks identified`,
      );
      console.log('Reasoning:', taskBreakdownResult.reasoning);
      taskLines.forEach((task, index) => {
        console.log(`Task ${index + 1}: ${task}`);
      });

      // Emit task breakdown completion event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'TASK_BREAKDOWN_COMPLETED',
          message: `Question broken down into ${taskLines.length} focused ${taskLines.length === 1 ? 'task' : 'tasks'}`,
          details: {
            query: state.query,
            taskCount: taskLines.length,
            tasks: taskLines,
            reasoning: taskBreakdownResult.reasoning,
          },
        },
      });

      const responseMessage =
        taskLines.length === 1
          ? 'Question is already focused and ready for processing'
          : `Question broken down into ${taskLines.length} focused tasks for parallel processing`;

      return new Command({
        goto: 'content_router', // Route to content router to decide between file search, web search, or analysis
        update: {
          // messages: [new AIMessage(responseMessage)],
          tasks: taskLines,
          currentTaskIndex: 0,
          originalQuery: state.originalQuery || state.query, // Preserve original if not already set
        },
      });
    } catch (error) {
      console.error('Task breakdown error:', error);
      const errorMessage = new AIMessage(
        `Task breakdown failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return new Command({
        goto: 'content_router', // Fallback to content router with original query
        update: {
          messages: [errorMessage],
          tasks: [state.query], // Use original query as single task
          currentTaskIndex: 0,
          originalQuery: state.originalQuery || state.query, // Preserve original if not already set
        },
      });
    } finally {
      setTemperature(this.llm, undefined); // Reset temperature to default
    }
  }
}
