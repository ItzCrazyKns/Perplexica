import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { PromptTemplate } from '@langchain/core/prompts';
import { Command, END } from '@langchain/langgraph';
import { EventEmitter } from 'events';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { AgentState } from './agentState';
import { contentRouterPrompt } from '../prompts/contentRouter';
import { removeThinkingBlocksFromMessages } from '../utils/contentUtils';

// Define Zod schema for structured router decision output
const RouterDecisionSchema = z.object({
  decision: z
    .enum(['file_search', 'web_search', 'analyzer'])
    .describe('The next step to take in the workflow'),
  reasoning: z.string().describe('Explanation of why this decision was made'),
});

type RouterDecision = z.infer<typeof RouterDecisionSchema>;

export class ContentRouterAgent {
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
   * Content router agent node
   */
  async execute(state: typeof AgentState.State): Promise<Command> {
    try {
      // Determine current task to process
      const currentTask =
        state.tasks && state.tasks.length > 0
          ? state.tasks[state.currentTaskIndex || 0]
          : state.query;

      console.log(
        `Content router processing task ${(state.currentTaskIndex || 0) + 1} of ${state.tasks?.length || 1}: "${currentTask}"`,
      );

      // Extract focus mode from state - this should now come from the API
      const focusMode = state.focusMode || 'webSearch';

      const hasFiles = state.fileIds && state.fileIds.length > 0;
      const documentCount = state.relevantDocuments.length;
      const searchHistory = state.searchInstructionHistory.join(', ') || 'None';

      // Extract file topics if files are available
      const fileTopics = hasFiles
        ? await this.extractFileTopics(state.fileIds!)
        : 'None';

      // Emit routing decision event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'ROUTING_DECISION',
          message: `Determining optimal information source for current task`,
          details: {
            query: state.query,
            currentTask: currentTask,
            taskIndex: (state.currentTaskIndex || 0) + 1,
            totalTasks: state.tasks?.length || 1,
            focusMode: focusMode,
            hasFiles: hasFiles,
            fileCount: state.fileIds?.length || 0,
            documentCount: documentCount,
            searchIterations: state.searchInstructionHistory.length,
          },
        },
      });

      const template = PromptTemplate.fromTemplate(contentRouterPrompt);
      const prompt = await template.format({
        currentTask: currentTask,
        query: state.originalQuery || state.query,
        focusMode: focusMode,
        hasFiles: hasFiles,
        fileTopics: fileTopics,
        documentCount: documentCount,
        searchHistory: searchHistory,
      });

      // Use structured output for routing decision
      const structuredLlm = this.llm.withStructuredOutput(
        RouterDecisionSchema,
        {
          name: 'route_content',
        },
      );

      const routerDecision = (await structuredLlm.invoke(
        [...removeThinkingBlocksFromMessages(state.messages), prompt],
        { signal: this.signal },
      )) as RouterDecision;

      console.log(`Router decision: ${routerDecision.decision}`);
      console.log(`Router reasoning: ${routerDecision.reasoning}`);
      console.log(`File topics: ${fileTopics}`);
      console.log(`Focus mode: ${focusMode}`);

      // Validate decision based on focus mode restrictions
      const validatedDecision = this.validateDecision(
        routerDecision,
        focusMode,
        hasFiles,
      );

      // Emit routing result event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'ROUTING_RESULT',
          message: `Routing to ${validatedDecision.decision}: ${validatedDecision.reasoning}`,
          details: {
            query: state.query,
            currentTask: currentTask,
            taskIndex: (state.currentTaskIndex || 0) + 1,
            totalTasks: state.tasks?.length || 1,
            decision: validatedDecision.decision,
            focusMode: focusMode,
            hasFiles: hasFiles,
            documentCount: documentCount,
            searchIterations: state.searchInstructionHistory.length,
          },
        },
      });

      const responseMessage = `Content routing completed. Next step: ${validatedDecision.decision}`;
      console.log(responseMessage);

      return new Command({
        goto: validatedDecision.decision,
        update: {
          messages: [new AIMessage(responseMessage)],
        },
      });
    } catch (error) {
      console.error('Content router error:', error);
      const errorMessage = new AIMessage(
        `Content routing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return new Command({
        goto: END,
        update: {
          messages: [errorMessage],
        },
      });
    }
  }

  /**
   * Extract semantic topics from attached files for relevance assessment
   */
  private async extractFileTopics(fileIds: string[]): Promise<string> {
    try {
      const topics = fileIds.map((fileId) => {
        try {
          const filePath = path.join(process.cwd(), 'uploads', fileId);
          const contentPath = filePath + '-extracted.json';

          if (fs.existsSync(contentPath)) {
            const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
            const filename = content.title || 'Document';

            // Use LLM-generated semantic topics if available, otherwise fall back to filename
            const semanticTopics = content.topics;
            return semanticTopics || filename;
          }
          return 'Unknown Document';
        } catch (error) {
          console.warn(`Error extracting topic for file ${fileId}:`, error);
          return 'Unknown Document';
        }
      });

      return topics.join('; ');
    } catch (error) {
      console.warn('Error extracting file topics:', error);
      return 'Unable to determine file topics';
    }
  }

  /**
   * Validate and potentially override the router decision based on focus mode restrictions
   */
  private validateDecision(
    decision: RouterDecision,
    focusMode: string,
    hasFiles: boolean,
  ): RouterDecision {
    // Enforce focus mode restrictions for chat and localResearch modes
    if (
      (focusMode === 'chat' || focusMode === 'localResearch') &&
      decision.decision === 'web_search'
    ) {
      // Override to file_search if files are available, otherwise analyzer
      const fallbackDecision = hasFiles ? 'file_search' : 'analyzer';

      console.log(
        `Overriding web_search decision to ${fallbackDecision} due to focus mode restriction: ${focusMode}`,
      );

      return {
        decision: fallbackDecision as 'file_search' | 'analyzer',
        reasoning: `Overridden to ${fallbackDecision} - web search not allowed in ${focusMode} mode. ${decision.reasoning}`,
      };
    }

    // For webSearch mode, trust the LLM's decision about file relevance
    // No overrides needed - the enhanced prompt handles file relevance assessment
    return decision;
  }
}
