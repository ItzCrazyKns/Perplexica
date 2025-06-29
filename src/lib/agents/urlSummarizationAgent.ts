import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { Command, END } from '@langchain/langgraph';
import { EventEmitter } from 'events';
import { Document } from 'langchain/document';
import { AgentState } from './agentState';
import { getWebContent } from '../utils/documents';
import { removeThinkingBlocks } from '../utils/contentUtils';
import { setTemperature } from '../utils/modelUtils';

export class URLSummarizationAgent {
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
   * URL processing agent node
   */
  async execute(state: typeof AgentState.State): Promise<Command> {
    try {
      setTemperature(this.llm, 0); // Set temperature to 0 for deterministic output

      // Use pre-analyzed URLs from ContentRouterAgent
      const urlsToProcess = state.urlsToSummarize || [];
      const summarizationIntent = state.summarizationIntent || 'process content to help answer the user query';

      if (urlsToProcess.length === 0) {
        console.log('No URLs found for processing, routing back to content router');
        return new Command({
          goto: 'content_router',
          update: {
            messages: [new AIMessage('No URLs found for processing, routing to content router')],
          },
        });
      }

      console.log(`URL processing detected. URLs: ${urlsToProcess.join(', ')}`);
      console.log(`Processing intent: ${summarizationIntent}`);

      // Emit URL detection event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'URL_PROCESSING_DETECTED',
          message: `Processing ${urlsToProcess.length} URL(s) to extract content for analysis`,
          details: {
            query: state.query,
            urls: urlsToProcess,
            intent: summarizationIntent,
          },
        },
      });

      const documents: Document[] = [];

      // Process each URL
      for (const url of urlsToProcess) {
        if (this.signal.aborted) {
          console.warn('URL summarization operation aborted by signal');
          break;
        }

        try {
          // Emit URL processing event
          this.emitter.emit('agent_action', {
            type: 'agent_action',
            data: {
              action: 'PROCESSING_URL',
              message: `Retrieving and processing content from: ${url}`,
              details: {
                query: state.query,
                sourceUrl: url,
                intent: summarizationIntent,
              },
            },
          });

          // Fetch full content using the enhanced web content retrieval
          const webContent = await getWebContent(url, true);

          if (!webContent || !webContent.pageContent) {
            console.warn(`No content retrieved from URL: ${url}`);
            
            // Emit URL processing failure event
            this.emitter.emit('agent_action', {
              type: 'agent_action',
              data: {
                action: 'URL_PROCESSING_FAILED',
                message: `Failed to retrieve content from: ${url}`,
                details: {
                  query: state.query,
                  sourceUrl: url,
                  reason: 'No content retrieved',
                },
              },
            });
            continue;
          }

          const contentLength = webContent.pageContent.length;
          let finalContent: string;
          let processingType: string;

          // If content is short (< 4000 chars), use it directly; otherwise summarize
          if (contentLength < 4000) {
            finalContent = webContent.pageContent;
            processingType = 'url-direct-content';
            
            console.log(`Content is short (${contentLength} chars), using directly without summarization`);
            
            // Emit direct content usage event
            this.emitter.emit('agent_action', {
              type: 'agent_action',
              data: {
                action: 'URL_DIRECT_CONTENT',
                message: `Content is short (${contentLength} chars), using directly from: ${url}`,
                details: {
                  query: state.query,
                  sourceUrl: url,
                  sourceTitle: webContent.metadata.title || 'Web Page',
                  contentLength: contentLength,
                  intent: summarizationIntent,
                },
              },
            });
          } else {
            // Content is long, summarize using LLM
            console.log(`Content is long (${contentLength} chars), generating summary`);
            
            const systemPrompt = this.systemInstructions
              ? `${this.systemInstructions}\n\n`
              : '';

            const summarizationPrompt = `${systemPrompt}You are a web content processor. Extract and summarize ONLY the information from the provided web page content that is relevant to the user's query.

# Critical Instructions
- Output ONLY a summary of the web page content provided below
- Focus on information that relates to or helps answer the user's query
- Do NOT add pleasantries, greetings, or conversational elements
- Do NOT mention missing URLs, other pages, or content not provided
- Do NOT ask follow-up questions or suggest additional actions
- Do NOT add commentary about the user's request or query
- Present the information in a clear, well-structured format with key facts and details
- Include all relevant details that could help answer the user's question

# User's Query: ${state.query}

# Content Title: ${webContent.metadata.title || 'Web Page'}
# Content URL: ${url}

# Web Page Content to Summarize:
${webContent.pageContent}

Provide a comprehensive summary of the above web page content, focusing on information relevant to the user's query:`;

            const result = await this.llm.invoke(summarizationPrompt, {
              signal: this.signal,
            });

            finalContent = removeThinkingBlocks(result.content as string);
            processingType = 'url-content-extraction';
          }

          if (finalContent && finalContent.trim().length > 0) {
            const document = new Document({
              pageContent: finalContent,
              metadata: {
                title: webContent.metadata.title || 'URL Content',
                url: url,
                source: url,
                processingType: processingType,
                processingIntent: summarizationIntent,
                originalContentLength: contentLength,
              },
            });

            documents.push(document);

            // Emit successful URL processing event
            this.emitter.emit('agent_action', {
              type: 'agent_action',
              data: {
                action: 'URL_CONTENT_EXTRACTED',
                message: `Successfully processed content from: ${url}`,
                details: {
                  query: state.query,
                  sourceUrl: url,
                  sourceTitle: webContent.metadata.title || 'Web Page',
                  contentLength: finalContent.length,
                  originalContentLength: contentLength,
                  processingType: processingType,
                  intent: summarizationIntent,
                },
              },
            });

            console.log(
              `Successfully processed content from ${url} (${finalContent.length} characters, ${processingType})`,
            );
          } else {
            console.warn(`No valid content generated for URL: ${url}`);
          }
        } catch (error) {
          console.error(`Error processing URL ${url}:`, error);
          
          // Emit URL processing error event
          this.emitter.emit('agent_action', {
            type: 'agent_action',
            data: {
              action: 'URL_PROCESSING_ERROR',
              message: `Error processing URL: ${url}`,
              details: {
                query: state.query,
                sourceUrl: url,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            },
          });
        }
      }

      if (documents.length === 0) {
        const errorMessage = `No content could be retrieved or summarized from the provided URL(s): ${urlsToProcess.join(', ')}`;
        console.error(errorMessage);

        return new Command({
          goto: 'analyzer',
          update: {
            messages: [new AIMessage(errorMessage)],
          },
        });
      }

      // Emit completion event
      this.emitter.emit('agent_action', {
        type: 'agent_action',
        data: {
          action: 'URL_PROCESSING_COMPLETED',
          message: `Successfully processed ${documents.length} URL(s) and extracted content`,
          details: {
            query: state.query,
            processedUrls: urlsToProcess.length,
            successfulExtractions: documents.length,
            intent: summarizationIntent,
          },
        },
      });

      const responseMessage = `URL processing completed. Successfully processed ${documents.length} out of ${urlsToProcess.length} URLs.`;
      console.log(responseMessage);

      return new Command({
        goto: 'analyzer', // Route to analyzer to continue with normal workflow after URL processing
        update: {
          messages: [new AIMessage(responseMessage)],
          relevantDocuments: documents,
        },
      });
    } catch (error) {
      console.error('URL summarization error:', error);
      const errorMessage = new AIMessage(
        `URL summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
