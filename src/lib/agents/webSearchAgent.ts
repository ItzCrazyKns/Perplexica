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
import { AgentState } from './agentState';

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
    // Emit preparing web search event
    this.emitter.emit('agent_action', {
      type: 'agent_action',
      data: {
        action: 'PREPARING_SEARCH_QUERY',
        // message: `Preparing search query`,
        details: {
          query: state.query,
          searchInstructions: state.searchInstructions || state.query,
          documentCount: state.relevantDocuments.length,
          searchIterations: state.searchInstructionHistory.length
        }
      }
    });

    const template = PromptTemplate.fromTemplate(webSearchRetrieverAgentPrompt);
    const prompt = await template.format({
      systemInstructions: this.systemInstructions,
      query: state.query,
      date: formatDateForLLM(new Date()),
      supervisor: state.searchInstructions,
    });

    const searchQueryResult = await this.llm.invoke(
      [...state.messages, prompt],
      { signal: this.signal },
    );

    // Parse the response to extract the search query with the lineoutputparser
    const lineOutputParser = new LineOutputParser({ key: 'answer' });
    const searchQuery = await lineOutputParser.parse(
      searchQueryResult.content as string,
    );

    try {
      console.log(`Performing web search for query: "${searchQuery}"`);
      
      // Emit executing web search event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'EXECUTING_WEB_SEARCH',
          // message: `Searching the web for: '${searchQuery}'`,
          details: {
            query: state.query,
            searchQuery: searchQuery,
            documentCount: state.relevantDocuments.length,
            searchIterations: state.searchInstructionHistory.length
          }
        }
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
            searchQuery: searchQuery,
            sourcesFound: searchResults.results.length,
            documentCount: state.relevantDocuments.length,
            searchIterations: state.searchInstructionHistory.length
          }
        }
      });

      let bannedUrls = state.bannedUrls || [];
      let attemptedUrlCount = 0;
      // Summarize the top 2 search results
      let documents: Document[] = [];
      for (const result of searchResults.results) {
        if (bannedUrls.includes(result.url)) {
          console.log(`Skipping banned URL: ${result.url}`);
          // Note: We don't emit an agent_action event for banned URLs as this is an internal
          // optimization that should be transparent to the user
          continue; // Skip banned URLs
        }
        if (attemptedUrlCount >= 5) {
          console.warn(
            'Too many attempts to summarize URLs, stopping further attempts.',
          );
          break; // Limit the number of attempts to summarize URLs
        }
        attemptedUrlCount++;

        bannedUrls.push(result.url); // Add to banned URLs to avoid duplicates

        if (documents.length >= 1) {
          break; // Limit to top 1 document
        }

        // Emit analyzing source event
        this.emitter.emit('agent_action', {
          type: 'agent_action',
          data: {
            action: 'ANALYZING_SOURCE',
            message: `Analyzing content from: ${result.title || result.url}`,
            details: {
              query: state.query,
              sourceUrl: result.url,
              sourceTitle: result.title || 'Untitled',
              documentCount: state.relevantDocuments.length,
              searchIterations: state.searchInstructionHistory.length
            }
          }
        });

        const summaryResult = await summarizeWebContent(
          result.url,
          state.query,
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
                query: state.query,
                sourceUrl: result.url,
                sourceTitle: summaryResult.document.metadata.title || 'Untitled',
                contentLength: summaryResult.document.pageContent.length,
                documentCount: state.relevantDocuments.length + documents.length,
                searchIterations: state.searchInstructionHistory.length
              }
            }
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
                skipReason: summaryResult.notRelevantReason || 'Content was not relevant to the query',
                documentCount: state.relevantDocuments.length + documents.length,
                searchIterations: state.searchInstructionHistory.length
              }
            }
          });
        }
      }

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
        goto: 'analyzer',
        update: {
          messages: [new AIMessage(responseMessage)],
          relevantDocuments: documents,
          bannedUrls: bannedUrls,
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
    }
  }
}
