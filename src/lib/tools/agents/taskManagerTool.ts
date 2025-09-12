import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import { withStructuredOutput } from '@/lib/utils/structuredOutput';
import { PromptTemplate } from '@langchain/core/prompts';
import { taskBreakdownPrompt } from '@/lib/prompts/taskBreakdown';

// Schema for task manager tool input
const TaskManagerToolSchema = z.object({
  query: z.string().describe('The user query to break down into smaller tasks'),
  context: z
    .string()
    .optional()
    .describe('Additional context about the query or current situation'),
});

// Schema for structured output
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

/**
 * TaskManagerTool - Breaks down complex queries into manageable task lists
 *
 * This tool takes a user query and returns a list of specific, actionable tasks
 * that can help answer the original question. The tasks are returned as natural
 * language instructions that the main agent can follow.
 */
export const taskManagerTool = tool(
  async (
    input: z.infer<typeof TaskManagerToolSchema>,
    config?: RunnableConfig,
  ): Promise<{ tasks: string[]; reasoning: string }> => {
    try {
      console.log(
        'TaskManagerTool: Starting task breakdown for query:',
        input.query,
      );
      const { query, context = '' } = input;

      // Get LLM from config
      if (!config?.configurable?.systemLlm) {
        throw new Error('System LLM not available in config');
      }
      const llm = config.configurable.systemLlm;

      // Create structured LLM for task breakdown
      const structuredLLM = withStructuredOutput(llm, TaskBreakdownSchema, {
        name: 'task_breakdown',
        includeRaw: false,
      });

      // Create the prompt template
      const template = PromptTemplate.fromTemplate(taskBreakdownPrompt);

      // Format the prompt with the query and context
      const prompt = await template.format({
        fileContext: context || 'No additional context provided.',
        query: query,
        currentTasks: 0,
        taskHistory: 'No previous tasks.',
      });

      // Get the task breakdown from the LLM
      const response = await structuredLLM.invoke(prompt, {
        signal: config?.signal,
      });

      if (!response?.tasks || response.tasks.length === 0) {
        // If no breakdown is needed, return the original query as a single task
        return {
          tasks: [query],
          reasoning:
            'The query is straightforward and does not require breaking down into smaller tasks.',
        };
      }

      return {
        tasks: response.tasks,
        reasoning: response.reasoning,
      };
    } catch (error) {
      console.error('Error in TaskManagerTool:', error);
      // Fallback: return the original query as a single task
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        tasks: [input.query],
        reasoning: `Error occurred during task breakdown: ${errorMessage}. Proceeding with the original query.`,
      };
    }
  },
  {
    name: 'task_manager',
    description:
      'Breaks down complex user queries into a list of specific, manageable tasks that can be executed to answer the original question',
    schema: TaskManagerToolSchema,
  },
);
