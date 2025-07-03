import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Command, END } from '@langchain/langgraph';
import { EventEmitter } from 'events';
import { z } from 'zod';
import LineOutputParser from '../outputParsers/lineOutputParser';
import { formatDateForLLM } from '../utils';
import { AgentState } from './agentState';
import { setTemperature } from '../utils/modelUtils';
import {
  additionalUserInputPrompt,
  additionalWebSearchPrompt,
  decideNextActionPrompt,
} from '../prompts/analyzer';
import {
  removeThinkingBlocks,
  removeThinkingBlocksFromMessages,
} from '../utils/contentUtils';
import next from 'next';

// Define Zod schemas for structured output
const NextActionSchema = z.object({
  action: z
    .enum(['good_content', 'need_user_info', 'need_more_info'])
    .describe('The next action to take based on content analysis'),
  reasoning: z
    .string()
    .describe('Brief explanation of why this action was chosen'),
});

const UserInfoRequestSchema = z.object({
  question: z
    .string()
    .describe('A detailed question to ask the user for additional information'),
  reasoning: z
    .string()
    .describe('Explanation of why this information is needed'),
});

const SearchRefinementSchema = z.object({
  question: z
    .string()
    .describe('A refined search question to gather more specific information'),
  reasoning: z
    .string()
    .describe(
      'Explanation of what information is missing and why this search will help',
    ),
});

export class AnalyzerAgent {
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

  async execute(state: typeof AgentState.State): Promise<Command> {
    try {
      //setTemperature(this.llm, 0.0);

      // Initialize originalQuery if not set
      if (!state.originalQuery) {
        state.originalQuery = state.query;
      }

      // Check for URLs first - if found and not yet processed, route to URL summarization
      if (!state.urlsToSummarize || state.urlsToSummarize.length === 0) {
        const urlRegex = /https?:\/\/[^\s]+/gi;
        const urls = [...new Set(state.query.match(urlRegex) || [])];

        if (urls.length > 0) {
          console.log(
            'URLs detected in initial query, routing to URL summarization',
          );
          console.log(`URLs found: ${urls.join(', ')}`);

          // Emit URL detection event
          this.emitter.emit('agent_action', {
            type: 'agent_action',
            data: {
              action: 'URLS_DETECTED_ROUTING',
              message: `Detected ${urls.length} URL(s) in query - processing content first`,
              details: {
                query: state.query,
                urls: urls,
              },
            },
          });

          return new Command({
            goto: 'url_summarization',
            update: {
              urlsToSummarize: urls,
              summarizationIntent: `Process the content from the provided URLs to help answer: ${state.query}`,
            },
          });
        }
      }

      // Skip full analysis if this is the first run.
      //if (state.fullAnalysisAttempts > 0) {
      // Emit initial analysis event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'ANALYZING_CONTEXT',
          message:
            'Analyzing the context to see if we have enough information to answer the query',
          details: {
            documentCount: state.relevantDocuments.length,
            query: state.query,
            searchIterations: state.searchInstructionHistory.length,
          },
        },
      });

      console.log(
        `Analyzing ${state.relevantDocuments.length} documents for relevance...`,
      );

      const nextActionPrompt = await ChatPromptTemplate.fromTemplate(
        decideNextActionPrompt,
      ).format({
        systemInstructions: this.systemInstructions,
        context: state.relevantDocuments
          .map(
            (doc, index) =>
              `<source${index + 1}>${doc?.metadata?.title ? `<title>${doc?.metadata?.title}</title>` : ''}${doc?.metadata.url ? `<url>${doc?.metadata?.url}</url>` : ''}<content>${doc.pageContent}</content></source${index + 1}>`,
          )
          .join('\n\n'),
        date: formatDateForLLM(new Date()),
        searchInstructionHistory: state.searchInstructionHistory
          .map((question) => `- ${question}`)
          .join('\n'),
        query: state.originalQuery || state.query, // Use original query for analysis context
      });

      const thinkingBlocksRemovedMessages = removeThinkingBlocksFromMessages(
        state.messages,
      );

      // Use structured output for next action decision
      const structuredLlm = this.llm.withStructuredOutput(NextActionSchema, {
        name: 'analyze_content',
      });

      const nextActionResponse = await structuredLlm.invoke(
        [...thinkingBlocksRemovedMessages, new HumanMessage(nextActionPrompt)],
        { signal: this.signal },
      );

      console.log('Next action response:', nextActionResponse);

      if (nextActionResponse.action !== 'good_content') {
        // If we don't have enough information, but we still have available tasks, proceed with the next task

        if (state.tasks && state.tasks.length > 0) {
          const hasMoreTasks = state.currentTaskIndex < state.tasks.length - 1;

          if (hasMoreTasks) {
            return new Command({
              goto: 'task_manager',
            });
          }
        }

        if (nextActionResponse.action === 'need_user_info') {
          // Use structured output for user info request
          const userInfoLlm = this.llm.withStructuredOutput(
            UserInfoRequestSchema,
            {
              name: 'request_user_info',
            },
          );

          const moreUserInfoPrompt = await ChatPromptTemplate.fromTemplate(
            additionalUserInputPrompt,
          ).format({
            systemInstructions: this.systemInstructions,
            context: state.relevantDocuments
              .map(
                (doc, index) =>
                  `<source${index + 1}>${doc?.metadata?.title ? `<title>${doc?.metadata?.title}</title>` : ''}<content>${doc.pageContent}</content></source${index + 1}>`,
              )
              .join('\n\n'),
            date: formatDateForLLM(new Date()),
            searchInstructionHistory: state.searchInstructionHistory
              .map((question) => `- ${question}`)
              .join('\n'),
            query: state.originalQuery || state.query, // Use original query for user info context
            previousAnalysis: nextActionResponse.reasoning, // Include reasoning from previous analysis
          });

          const userInfoRequest = await userInfoLlm.invoke(
            [
              ...removeThinkingBlocksFromMessages(state.messages),
              new HumanMessage(moreUserInfoPrompt),
            ],
            { signal: this.signal },
          );

          // Emit the complete question to the user
          this.emitter.emit(
            'data',
            JSON.stringify({
              type: 'response',
              data: userInfoRequest.question,
            }),
          );

          this.emitter.emit('end');

          // Create the final response message with the complete content
          const response = new SystemMessage(userInfoRequest.question);

          return new Command({
            goto: END,
            update: {
              messages: [response],
            },
          });
        }

        // If we need more information from the LLM, generate a more specific search query
        // Use structured output for search refinement
        const searchRefinementLlm = this.llm.withStructuredOutput(
          SearchRefinementSchema,
          {
            name: 'refine_search',
          },
        );

        const moreInfoPrompt = await ChatPromptTemplate.fromTemplate(
          additionalWebSearchPrompt,
        ).format({
          systemInstructions: this.systemInstructions,
          context: state.relevantDocuments
            .map(
              (doc, index) =>
                `<source${index + 1}>${doc?.metadata?.title ? `<title>${doc?.metadata?.title}</title>` : ''}<content>${doc.pageContent}</content></source${index + 1}>`,
            )
            .join('\n\n'),
          date: formatDateForLLM(new Date()),
          searchInstructionHistory: state.searchInstructionHistory
            .map((question) => `- ${question}`)
            .join('\n'),
          query: state.originalQuery || state.query, // Use original query for more info context
          previousAnalysis: nextActionResponse.reasoning, // Include reasoning from previous analysis
        });

        const searchRefinement = await searchRefinementLlm.invoke(
          [
            ...removeThinkingBlocksFromMessages(state.messages),
            new HumanMessage(moreInfoPrompt),
          ],
          { signal: this.signal },
        );

        // Emit reanalyzing event when we need more information
        this.emitter.emit('agent_action', {
          type: 'agent_action',
          data: {
            action: 'MORE_DATA_NEEDED',
            message:
              'Current context is insufficient - analyzing search requirements',
            details: {
              nextSearchQuery: searchRefinement.question,
              documentCount: state.relevantDocuments.length,
              searchIterations: state.searchInstructionHistory.length,
              query: state.originalQuery || state.query, // Show original query in details
              currentSearchFocus: searchRefinement.question,
            },
          },
        });

        return new Command({
          goto: 'task_manager',
          update: {
            messages: [
              new AIMessage(
                `The following question can help refine the search: ${searchRefinement.question}`,
              ),
            ],
            query: searchRefinement.question, // Use the refined question for TaskManager to analyze
            searchInstructions: searchRefinement.question,
            searchInstructionHistory: [
              ...(state.searchInstructionHistory || []),
              searchRefinement.question,
            ],
            fullAnalysisAttempts: 1,
            originalQuery: state.originalQuery || state.query, // Preserve the original user query
            // Reset task list so TaskManager can break down the search requirements again
            tasks: [],
            currentTaskIndex: 0,
          },
        });
      }

      // Emit information gathering complete event when we have sufficient information
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'INFORMATION_GATHERING_COMPLETE',
          message: 'Ready to respond.',
          details: {
            documentCount: state.relevantDocuments.length,
            searchIterations: state.searchInstructionHistory.length,
            totalTasks: state.tasks?.length || 1,
            query: state.originalQuery || state.query,
          },
        },
      });

      return new Command({
        goto: 'synthesizer',
        update: {
          messages: [
            new AIMessage(
              `Analysis completed. We have sufficient information to answer the query.`,
            ),
          ],
        },
      });
    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = new AIMessage(
        `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return new Command({
        goto: END,
        update: {
          messages: [errorMessage],
        },
      });
    } finally {
      setTemperature(this.llm); // Reset temperature for subsequent actions
    }
  }
}
