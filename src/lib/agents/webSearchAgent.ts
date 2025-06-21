import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { PromptTemplate } from '@langchain/core/prompts';
import { Command, END } from '@langchain/langgraph';
import { EventEmitter } from 'events';
import { Document } from 'langchain/document';
import LineOutputParser from '../outputParsers/lineOutputParser';
import { webSearchRetrieverAgentPrompt } from '../prompts/webSearch';
import { searchSearxng } from '../searxng';
import { formatDateForLLM } from '../utils';
import { summarizeWebContent } from '../utils/summarizeWebContent';
import {
  analyzePreviewContent,
  PreviewContent,
} from '../utils/analyzePreviewContent';
import { AgentState } from './agentState';
import { setTemperature } from '../utils/modelUtils';
import { Embeddings } from '@langchain/core/embeddings';
import { removeThinkingBlocksFromMessages } from '../utils/contentUtils';

export class WebSearchAgent {
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
   * Web search agent node
   */
  async execute(state: typeof AgentState.State): Promise<Command> {
    try {
      setTemperature(this.llm, 0); // Set temperature to 0 for deterministic output

      // Determine current task to process
      const currentTask =
        state.tasks && state.tasks.length > 0
          ? state.tasks[state.currentTaskIndex || 0]
          : state.query;

      console.log(
        `Processing task ${(state.currentTaskIndex || 0) + 1} of ${state.tasks?.length || 1}: "${currentTask}"`,
      );

      // Emit preparing web search event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'PREPARING_SEARCH_QUERY',
          // message: `Preparing search query`,
          details: {
            query: state.query,
            currentTask: currentTask,
            taskIndex: (state.currentTaskIndex || 0) + 1,
            totalTasks: state.tasks?.length || 1,
            searchInstructions: state.searchInstructions || currentTask,
            documentCount: state.relevantDocuments.length,
            searchIterations: state.searchInstructionHistory.length,
          },
        },
      });

      const template = PromptTemplate.fromTemplate(
        webSearchRetrieverAgentPrompt,
      );
      const prompt = await template.format({
        systemInstructions: this.systemInstructions,
        query: currentTask, // Use current task instead of main query
        date: formatDateForLLM(new Date()),
        supervisor: state.searchInstructions,
      });

      const searchQueryResult = await this.llm.invoke(
        [...removeThinkingBlocksFromMessages(state.messages), prompt],
        { signal: this.signal },
      );

      // Parse the response to extract the search query with the lineoutputparser
      const lineOutputParser = new LineOutputParser({ key: 'answer' });
      const searchQuery = await lineOutputParser.parse(
        searchQueryResult.content as string,
      );

      console.log(`Performing web search for query: "${searchQuery}"`);

      // Emit executing web search event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'EXECUTING_WEB_SEARCH',
          // message: `Searching the web for: '${searchQuery}'`,
          details: {
            query: state.query,
            currentTask: currentTask,
            taskIndex: (state.currentTaskIndex || 0) + 1,
            totalTasks: state.tasks?.length || 1,
            searchQuery: searchQuery,
            documentCount: state.relevantDocuments.length,
            searchIterations: state.searchInstructionHistory.length,
          },
        },
      });

      const searchResults = await searchSearxng(searchQuery, {
        language: 'en',
        engines: [],
      });

      // Emit web sources identified event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'WEB_SOURCES_IDENTIFIED',
          message: `Found ${searchResults.results.length} potential web sources`,
          details: {
            query: state.query,
            currentTask: currentTask,
            taskIndex: (state.currentTaskIndex || 0) + 1,
            totalTasks: state.tasks?.length || 1,
            searchQuery: searchQuery,
            sourcesFound: searchResults.results.length,
            documentCount: state.relevantDocuments.length,
            searchIterations: state.searchInstructionHistory.length,
          },
        },
      });

      let bannedSummaryUrls = state.bannedSummaryUrls || [];
      let bannedPreviewUrls = state.bannedPreviewUrls || [];

      // Extract preview content from top 8 search results for analysis
      const previewContents: PreviewContent[] = searchResults.results
        .filter(
          (result) =>
            !bannedSummaryUrls.includes(result.url) &&
            !bannedPreviewUrls.includes(result.url),
        ) // Filter out banned URLs first
        .slice(0, 8) // Then take top 8 results
        .map((result) => ({
          title: result.title || 'Untitled',
          snippet: result.content || '',
          url: result.url,
        }));

      console.log(
        `Extracted preview content from ${previewContents.length} search results for analysis`,
      );

      // Perform preview analysis to determine if full content retrieval is needed
      let previewAnalysisResult = null;
      if (previewContents.length > 0) {
        console.log(
          'Starting preview content analysis to determine if full processing is needed',
        );

        // Emit preview analysis event
        this.emitter.emit('agent_action', {
          type: 'agent_action',
          data: {
            action: 'ANALYZING_PREVIEW_CONTENT',
            message: `Analyzing ${previewContents.length} search result previews to determine processing approach`,
            details: {
              query: currentTask,
              previewCount: previewContents.length,
              documentCount: state.relevantDocuments.length,
              searchIterations: state.searchInstructionHistory.length,
            },
          },
        });

        previewAnalysisResult = await analyzePreviewContent(
          previewContents,
          currentTask,
          removeThinkingBlocksFromMessages(state.messages),
          this.llm,
          this.systemInstructions,
          this.signal,
        );

        console.log(
          `Preview analysis result: ${previewAnalysisResult.isSufficient ? 'SUFFICIENT' : 'INSUFFICIENT'}${previewAnalysisResult.reason ? ` - ${previewAnalysisResult.reason}` : ''}`,
        );
      }

      let documents: Document[] = [];
      let attemptedUrlCount = 0; // Declare outside conditional blocks

      // Conditional workflow based on preview analysis result
      if (previewAnalysisResult && previewAnalysisResult.isSufficient) {
        // Preview content is sufficient - create documents from preview content
        console.log(
          'Preview content determined sufficient - skipping full content retrieval',
        );

        // Emit preview processing event
        this.emitter.emit('agent_action', {
          type: 'agent_action',
          data: {
            action: 'PROCESSING_PREVIEW_CONTENT',
            message: `Using preview content from ${previewContents.length} sources - no full content retrieval needed`,
            details: {
              query: currentTask,
              previewCount: previewContents.length,
              documentCount: state.relevantDocuments.length,
              searchIterations: state.searchInstructionHistory.length,
              processingType: 'preview-only',
            },
          },
        });

        // Create documents from preview content
        documents = previewContents.map(
          (content, index) =>
            new Document({
              pageContent: `# ${content.title}\n\n${content.snippet}`,
              metadata: {
                title: content.title,
                url: content.url,
                source: content.url,
                processingType: 'preview-only',
                snippet: content.snippet,
              },
            }),
        );

        previewContents.forEach((content) => {
          bannedPreviewUrls.push(content.url); // Add to banned preview URLs to avoid duplicates
        });

        console.log(
          `Created ${documents.length} documents from preview content`,
        );
      } else {
        // Preview content is insufficient - proceed with full content processing
        const insufficiencyReason =
          previewAnalysisResult?.reason ||
          'Preview content not available or insufficient';
        console.log(
          `Preview content insufficient: ${insufficiencyReason} - proceeding with full content retrieval`,
        );

        // Emit full processing event
        this.emitter.emit('agent_action', {
          type: 'agent_action',
          data: {
            action: 'PROCEEDING_WITH_FULL_ANALYSIS',
            message: `Preview content insufficient - proceeding with detailed content analysis`,
            details: {
              query: currentTask,
              insufficiencyReason: insufficiencyReason,
              documentCount: state.relevantDocuments.length,
              searchIterations: state.searchInstructionHistory.length,
              processingType: 'full-content',
            },
          },
        });

        // Summarize the top 2 search results
        for (const result of searchResults.results.slice(0, 8)) {
          if (this.signal.aborted) {
            console.warn('Search operation aborted by signal');
            break; // Exit if the operation is aborted
          }

          if (bannedSummaryUrls.includes(result.url)) {
            console.log(`Skipping banned URL: ${result.url}`);
            // Note: We don't emit an agent_action event for banned URLs as this is an internal
            // optimization that should be transparent to the user
            continue; // Skip banned URLs
          }
          // if (attemptedUrlCount >= 5) {
          //   console.warn(
          //     'Too many attempts to summarize URLs, stopping further attempts.',
          //   );
          //   break; // Limit the number of attempts to summarize URLs
          // }
          attemptedUrlCount++;

          bannedSummaryUrls.push(result.url); // Add to banned URLs to avoid duplicates

          if (documents.length >= 2) {
            break; // Limit to top 1 document
          }

          // Emit analyzing source event
          this.emitter.emit('agent_action', {
            type: 'agent_action',
            data: {
              action: 'ANALYZING_SOURCE',
              message: `Analyzing content from: ${result.title || result.url}`,
              details: {
                query: currentTask,
                sourceUrl: result.url,
                sourceTitle: result.title || 'Untitled',
                documentCount: state.relevantDocuments.length,
                searchIterations: state.searchInstructionHistory.length,
              },
            },
          });

          const summaryResult = await summarizeWebContent(
            result.url,
            currentTask,
            this.llm,
            this.systemInstructions,
            this.signal,
          );

          if (summaryResult.document) {
            documents.push(summaryResult.document);

            // Emit context updated event
            this.emitter.emit('agent_action', {
              type: 'agent_action',
              data: {
                action: 'CONTEXT_UPDATED',
                message: `Added information from ${summaryResult.document.metadata.title || result.url} to context`,
                details: {
                  query: currentTask,
                  sourceUrl: result.url,
                  sourceTitle:
                    summaryResult.document.metadata.title || 'Untitled',
                  contentLength: summaryResult.document.pageContent.length,
                  documentCount:
                    state.relevantDocuments.length + documents.length,
                  searchIterations: state.searchInstructionHistory.length,
                },
              },
            });

            console.log(
              `Summarized content from ${result.url} to ${summaryResult.document.pageContent.length} characters. Content: ${summaryResult.document.pageContent}`,
            );
          } else {
            console.warn(`No relevant content found for URL: ${result.url}`);

            // Emit skipping irrelevant source event for non-relevant content
            this.emitter.emit('agent_action', {
              type: 'agent_action',
              data: {
                action: 'SKIPPING_IRRELEVANT_SOURCE',
                message: `Source ${result.title || result.url} was not relevant - trying next`,
                details: {
                  query: state.query,
                  sourceUrl: result.url,
                  sourceTitle: result.title || 'Untitled',
                  skipReason:
                    summaryResult.notRelevantReason ||
                    'Content was not relevant to the query',
                  documentCount:
                    state.relevantDocuments.length + documents.length,
                  searchIterations: state.searchInstructionHistory.length,
                },
              },
            });
          }
        }
      } // Close the else block for full content processing

      if (documents.length === 0) {
        return new Command({
          goto: 'analyzer',
          update: {
            messages: [new AIMessage('No relevant documents found.')],
          },
        });
      }

      const responseMessage = `Web search completed. ${documents.length === 0 && attemptedUrlCount < 5 ? 'This search query does not have enough relevant information. Try rephrasing your query or providing more context.' : `Found ${documents.length} results that are relevant to the query.`}`;
      console.log(responseMessage);

      return new Command({
        goto: 'task_manager', // Route back to task manager to check if more tasks remain
        update: {
          messages: [new AIMessage(responseMessage)],
          relevantDocuments: documents,
          bannedSummaryUrls: bannedSummaryUrls,
          bannedPreviewUrls: bannedPreviewUrls,
        },
      });
    } catch (error) {
      console.error('Web search error:', error);
      const errorMessage = new AIMessage(
        `Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return new Command({
        goto: END,
        update: {
          messages: [errorMessage],
        },
      });
    } finally {
      setTemperature(this.llm, undefined); // Reset temperature to default
    }
  }
}
