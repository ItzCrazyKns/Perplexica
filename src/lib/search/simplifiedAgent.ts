import { buildChatPrompt } from '@/lib/prompts/simplifiedAgent/chat';
import { buildFirefoxAIPrompt } from '@/lib/prompts/simplifiedAgent/firefoxAI';
import { buildLocalResearchPrompt } from '@/lib/prompts/simplifiedAgent/localResearch';
import { buildWebSearchPrompt } from '@/lib/prompts/simplifiedAgent/webSearch';
import { formattingAndCitationsWeb } from '@/lib/prompts/templates';
import { SimplifiedAgentState } from '@/lib/state/chatAgentState';
import {
  allAgentTools,
  coreTools,
  fileSearchTools,
  webSearchTools,
} from '@/lib/tools/agents';
import {
  getLangfuseCallbacks,
  getLangfuseHandler,
} from '@/lib/tracing/langfuse';
import { encodeHtmlAttribute } from '@/lib/utils/html';
import { isSoftStop } from '@/lib/utils/runControl';
import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableConfig, RunnableSequence } from '@langchain/core/runnables';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { EventEmitter } from 'events';
import { webSearchResponsePrompt } from '../prompts/webSearch';
import { formatDateForLLM } from '../utils';
import { removeThinkingBlocksFromMessages } from '../utils/contentUtils';
import { getModelName } from '../utils/modelUtils';
import { CachedEmbeddings } from '../utils/cachedEmbeddings';

/**
 * Normalize usage metadata from different LLM providers
 */
function normalizeUsageMetadata(usageData: any): {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
} {
  if (!usageData) return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

  // Handle different provider formats
  const inputTokens =
    usageData.input_tokens ||
    usageData.prompt_tokens ||
    usageData.promptTokens ||
    usageData.usedTokens ||
    0;

  const outputTokens =
    usageData.output_tokens ||
    usageData.completion_tokens ||
    usageData.completionTokens ||
    0;

  const totalTokens =
    usageData.total_tokens ||
    usageData.totalTokens ||
    usageData.usedTokens ||
    inputTokens + outputTokens;

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
  };
}

/**
 * SimplifiedAgent class that provides a streamlined interface for creating and managing an AI agent
 * with customizable focus modes and tools.
 */
export class SimplifiedAgent {
  private chatLlm: BaseChatModel;
  private systemLlm: BaseChatModel;
  private embeddings: CachedEmbeddings;
  private emitter: EventEmitter;
  private personaInstructions: string;
  private signal: AbortSignal;
  private currentToolNames: string[] = [];
  private messageId?: string;
  private retrievalSignal?: AbortSignal;

  constructor(
    chatLlm: BaseChatModel,
    systemLlm: BaseChatModel,
    embeddings: CachedEmbeddings,
    emitter: EventEmitter,
    personaInstructions: string = '',
    signal: AbortSignal,
    messageId?: string,
    retrievalSignal?: AbortSignal,
  ) {
    this.chatLlm = chatLlm;
    this.systemLlm = systemLlm;
    this.embeddings = embeddings;
    this.emitter = emitter;
    this.personaInstructions = personaInstructions;
    this.signal = signal;
    this.messageId = messageId;
    this.retrievalSignal = retrievalSignal;
  }

  private emitResponse(text: string) {
    this.emitter.emit('data', JSON.stringify({ type: 'response', data: text }));
  }

  /**
   * Initialize the createReactAgent with tools and configuration
   */
  private initializeAgent(
    focusMode: string,
    fileIds: string[] = [],
    messagesCount?: number,
    query?: string,
    firefoxAIDetected?: boolean,
  ) {
    // Select appropriate tools based on focus mode and available files
    // Special case: Firefox AI detection disables tools for this turn
    const tools = firefoxAIDetected
      ? []
      : this.getToolsForFocusMode(focusMode, fileIds);

    // Cache tool names for usage attribution heuristics
    this.currentToolNames = tools.map((t) => t.name.toLowerCase());

    const enhancedSystemPrompt = this.createEnhancedSystemPrompt(
      focusMode,
      fileIds,
      messagesCount,
      query,
      firefoxAIDetected,
    );

    try {
      // Create the React agent with custom state
      const agent = createReactAgent({
        llm: this.chatLlm,
        tools,
        stateSchema: SimplifiedAgentState,
        prompt: enhancedSystemPrompt,
      });

      console.log(
        `SimplifiedAgent: Initialized with ${tools.length} tools for focus mode: ${focusMode}`,
      );
      if (firefoxAIDetected) {
        console.log(
          'SimplifiedAgent: Firefox AI prompt detected, tools will be disabled for this turn.',
        );
      }
      console.log(
        `SimplifiedAgent: Tools available: ${tools.map((tool) => tool.name).join(', ')}`,
      );
      if (fileIds.length > 0) {
        console.log(
          `SimplifiedAgent: ${fileIds.length} files available for search`,
        );
      }

      return agent;
    } catch (error) {
      console.error('SimplifiedAgent: Error initializing agent:', error);
      throw error;
    }
  }

  /**
   * Get tools based on focus mode
   */
  private getToolsForFocusMode(focusMode: string, fileIds: string[] = []) {
    switch (focusMode) {
      case 'chat':
        // Chat mode: Only core tools for conversational interaction
        return coreTools;
      case 'webSearch':
        // Web search mode: ALL available tools for comprehensive research
        // Include file search tools if files are available
        if (fileIds.length > 0) {
          return [...webSearchTools, ...fileSearchTools];
        }
        return allAgentTools;
      case 'localResearch':
        // Local research mode: File search tools + core tools
        return [...coreTools, ...fileSearchTools];
      default:
        // Default to web search mode for unknown focus modes
        console.warn(
          `SimplifiedAgent: Unknown focus mode "${focusMode}", defaulting to webSearch tools`,
        );
        if (fileIds.length > 0) {
          return [...webSearchTools, ...fileSearchTools];
        }
        return allAgentTools;
    }
  }

  private createEnhancedSystemPrompt(
    focusMode: string,
    fileIds: string[] = [],
    messagesCount?: number,
    query?: string,
    firefoxAIDetected?: boolean,
  ): string {
    const personaInstructions = this.personaInstructions || '';

    if (firefoxAIDetected) {
      return buildFirefoxAIPrompt(personaInstructions, new Date());
    }

    // Create focus-mode-specific prompts
    switch (focusMode) {
      case 'chat':
        return buildChatPrompt(personaInstructions, new Date());
      case 'webSearch':
        return buildWebSearchPrompt(
          personaInstructions,
          fileIds,
          messagesCount ?? 0,
          query,
          new Date(),
        );
      case 'localResearch':
        return buildLocalResearchPrompt(personaInstructions, new Date());
      default:
        console.warn(
          `SimplifiedAgent: Unknown focus mode "${focusMode}", using webSearch prompt`,
        );
        return buildWebSearchPrompt(
          personaInstructions,
          fileIds,
          messagesCount ?? 0,
          query,
          new Date(),
        );
    }
  }

  /**
   * Execute the simplified agent workflow
   */
  async searchAndAnswer(
    query: string,
    history: BaseMessage[] = [],
    fileIds: string[] = [],
    focusMode: string = 'webSearch',
  ): Promise<void> {
    try {
      console.log(`SimplifiedAgent: Starting search for query: "${query}"`);
      console.log(`SimplifiedAgent: Focus mode: ${focusMode}`);
      console.log(`SimplifiedAgent: File IDs: ${fileIds.join(', ')}`);

      // Write this on a background thread after a delay otherwise the emitter won't be listening
      setTimeout(() => {
        this.emitResponse(''); // Empty response, to give the UI a message to display.
      }, 100);

      const messagesHistory = [
        ...removeThinkingBlocksFromMessages(history),
        new HumanMessage(query),
      ];
      // Detect Firefox AI prompt pattern
      const trimmed = query.trim();
      const startsWithAscii = trimmed.startsWith("I'm on page");
      const startsWithCurly = trimmed.startsWith('I’' + 'm on page'); // handle curly apostrophe variant
      const containsSelection = trimmed.includes('<selection>');
      const firefoxAIDetected =
        (startsWithAscii || startsWithCurly) && containsSelection;
      let toolCalls: Record<string, string> = {};

      // Initialize agent with the provided focus mode and file context
      // Pass the number of messages that will be sent to the LLM so prompts can adapt.
      const llmMessagesCount = messagesHistory.length;
      const agent = this.initializeAgent(
        focusMode,
        fileIds,
        llmMessagesCount,
        query,
        firefoxAIDetected,
      );

      // Prepare initial state
      const initialState = {
        messages: messagesHistory,
        query,
        focusMode,
        fileIds,
        relevantDocuments: [],
      };

      // Configure the agent run
      const config: RunnableConfig = {
        configurable: {
          thread_id: `simplified_agent_${Date.now()}`,
          llm: this.chatLlm,
          systemLlm: this.systemLlm,
          embeddings: this.embeddings,
          fileIds,
          personaInstructions: this.personaInstructions,
          focusMode,
          emitter: this.emitter,
          firefoxAIDetected,
          // Pass through message and retrieval controls for tools
          messageId: this.messageId,
          retrievalSignal: this.retrievalSignal,
        },
        recursionLimit: 75, // Allow sufficient iterations for tool use
        signal: this.retrievalSignal,
        ...getLangfuseCallbacks(),
      };

      // Use streamEvents to capture both tool calls and token-level streaming
      const eventStream = agent.streamEvents(initialState, {
        ...config,
        version: 'v2',
        callbacks: [
          {
            handleToolStart: (
              tool,
              input,
              runId,
              parentRunId?,
              tags?,
              metadata?,
              runName?,
            ) => {
              console.log('SimplifiedAgent: Tool started:', {
                tool,
                input,
                runId,
                parentRunId,
                tags,
                metadata,
                runName,
              });
              toolCalls[runId] = runName || tool.name || 'unknown';

              // Emit a tool_call_started event so UI can display a running state spinner.
              try {
                const type = (runName || tool.name || 'unknown').trim();
                // We only include lightweight identifying args for now; avoid large payloads.
                let extraAttr = '';
                try {
                  if (input && typeof input === 'string') {
                    // Construct an object from the input json string if possible
                    const trimmed = input.trim();
                    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                      try {
                        input = JSON.parse(trimmed);
                      } catch {
                        // If parsing fails, fall back to original string
                        input = trimmed;
                      }
                    }
                  }
                  if (input && typeof input === 'object') {
                    if (typeof (input as any).query === 'string') {
                      // Encode query as attribute (basic escaping)
                      const q = encodeHtmlAttribute(
                        (input as any).query.slice(0, 200),
                      );
                      extraAttr = ` query="${q}"`;
                    } else if (Array.isArray((input as any).urls)) {
                      const count = (input as any).urls.length;
                      extraAttr = ` count="${count}"`;
                    } else if (typeof (input as any).pdfUrl === 'string') {
                      const u = encodeHtmlAttribute(
                        (input as any).pdfUrl.slice(0, 300),
                      );
                      extraAttr = ` url="${u}"`;
                    }
                  }
                } catch (attrErr) {
                  // Ignore attribute extraction errors
                }

                this.emitter.emit(
                  'data',
                  JSON.stringify({
                    type: 'tool_call_started',
                    data: {
                      // Provide initial markup with status running; toolCallId used for later update.
                      content: `<ToolCall type="${encodeHtmlAttribute(type)}" status="running" toolCallId="${encodeHtmlAttribute(runId)}"${extraAttr}></ToolCall>`,
                      toolCallId: runId,
                      status: 'running',
                    },
                  }),
                );
              } catch (emitErr) {
                console.warn('Failed to emit tool_call_started event', emitErr);
              }
            },
            handleToolEnd: (output, runId, parentRunId, tags) => {
              console.log('SimplifiedAgent: Tool completed:', {
                output,
                runId,
                parentRunId,
                tags,
              });

              // If youtube transcript tool, capture videoId for potential future UI enhancements
              let extra: Record<string, string> | undefined;
              if (toolCalls[runId] === 'youtube_transcript') {
                const videoId =
                  output?.update?.relevantDocuments?.[0]?.metadata?.source;
                if (videoId) {
                  extra = { videoId: String(videoId) };
                }
              }
              toolCalls[runId] && delete toolCalls[runId];

              // Emit success update so UI can swap spinner for checkmark
              try {
                this.emitter.emit(
                  'data',
                  JSON.stringify({
                    type: 'tool_call_success',
                    data: {
                      toolCallId: runId,
                      status: 'success',
                      ...(extra ? { extra } : {}),
                    },
                  }),
                );
              } catch (emitErr) {
                console.warn('Failed to emit tool_call_success event', emitErr);
              }
            },
            handleToolError: (err, runId, parentRunId, tags) => {
              console.error('SimplifiedAgent: Tool error:', {
                error: err,
                runId,
                parentRunId,
                tags,
              });

              const message =
                (err && (err.message || err.toString())) ||
                'Unknown tool error';
              // Emit error update to UI
              try {
                this.emitter.emit(
                  'data',
                  JSON.stringify({
                    type: 'tool_call_error',
                    data: {
                      toolCallId: runId,
                      status: 'error',
                      error: message.substring(0, 500),
                    },
                  }),
                );
              } catch (emitErr) {
                console.warn('Failed to emit tool_call_error event', emitErr);
              }
            },
          },
          getLangfuseHandler() || {},
        ],
      });

      let finalResult: any = null;
      let collectedDocuments: any[] = [];
      let currentResponseBuffer = '';
      // Separate usage trackers for chat (final answer) and system (tools/internal chains)
      let usageChat = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
      let usageSystem = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

      let initialMessageSent = false;
      let respondNowTriggered = false;

      try {
        // Process the event stream
        for await (const event of eventStream) {
          if (!initialMessageSent) {
            initialMessageSent = true;
            // If Firefox AI was detected, emit synthetic lifecycle events so UI can show a completed pseudo-tool
            if (firefoxAIDetected) {
              const syntheticId = `firefoxAI-${Date.now()}`;
              try {
                // Emit single started event already marked success to avoid double UI churn
                this.emitter.emit(
                  'data',
                  JSON.stringify({
                    type: 'tool_call_started',
                    data: {
                      content: `<ToolCall type="firefoxAI" status="success" toolCallId="${syntheticId}"></ToolCall>`,
                      toolCallId: syntheticId,
                      status: 'success',
                    },
                  }),
                );
              } catch (e) {
                console.warn(
                  'Failed to emit firefoxAI synthetic tool event',
                  e,
                );
              }
            }
          }

          const emitNewDocs = (newDocs: any[]) => {
            //Group by metadata.searchQuery and emit separate source blocks for each
            const groupedBySearchQuery = newDocs.reduce(
              (acc, doc) => {
                const searchQuery = doc.metadata?.searchQuery || 'Agent Search';
                if (!acc[searchQuery]) {
                  acc[searchQuery] = [];
                }
                acc[searchQuery].push(doc);
                return acc;
              },
              {} as Record<string, Document[]>,
            );

            for (const [searchQuery, docs] of Object.entries(
              groupedBySearchQuery,
            )) {
              this.emitter.emit(
                'data',
                JSON.stringify({
                  type: 'sources_added',
                  data: docs,
                  searchQuery,
                  searchUrl: '',
                }),
              );
            }
          };

          // Handle different event types
          if (
            event.event === 'on_chain_end' &&
            event.name === 'RunnableSequence'
          ) {
            finalResult = event.data.output;
            // Collect relevant documents from the final result
            if (finalResult && finalResult.relevantDocuments) {
              collectedDocuments.push(...finalResult.relevantDocuments);
              emitNewDocs(finalResult.relevantDocuments);
            }
          }

          // Collect sources from tool results
          if (
            event.event === 'on_chain_end' &&
            (event.name.includes('search') ||
              event.name.includes('Search') ||
              event.name.includes('tool') ||
              event.name.includes('Tool'))
          ) {
            // Handle LangGraph state updates with relevantDocuments
            if (event.data?.output && Array.isArray(event.data.output)) {
              for (const item of event.data.output) {
                if (
                  item.update &&
                  item.update.relevantDocuments &&
                  Array.isArray(item.update.relevantDocuments)
                ) {
                  collectedDocuments.push(...item.update.relevantDocuments);
                  emitNewDocs(item.update.relevantDocuments);
                }
              }
            }
          }

          // Handle streaming tool calls (for thought messages)
          if (event.event === 'on_chat_model_end' && event.data.output) {
            const output = event.data.output;
            const nameLower = (event.name || '').toLowerCase();
            console.log(`SimplifiedAgent: on_chat_model_end`, event);
            const isToolContext =
              output.tool_calls && output.tool_calls.length > 0;

            // Collect token usage from chat model end events
            if (output.usage_metadata) {
              const normalized = normalizeUsageMetadata(output.usage_metadata);
              if (isToolContext) {
                usageSystem.input_tokens += normalized.input_tokens;
                usageSystem.output_tokens += normalized.output_tokens;
                usageSystem.total_tokens += normalized.total_tokens;
              } else {
                usageChat.input_tokens += normalized.input_tokens;
                usageChat.output_tokens += normalized.output_tokens;
                usageChat.total_tokens += normalized.total_tokens;
              }
              console.log(
                'SimplifiedAgent: Collected usage from usage_metadata:',
                normalized,
              );
              // Emit live snapshot
              this.emitter.emit(
                'stats',
                JSON.stringify({
                  type: 'modelStats',
                  data: {
                    modelName: getModelName(this.chatLlm),
                    modelNameChat: getModelName(this.chatLlm),
                    modelNameSystem: getModelName(this.systemLlm),
                    usage: {
                      input_tokens:
                        usageChat.input_tokens + usageSystem.input_tokens,
                      output_tokens:
                        usageChat.output_tokens + usageSystem.output_tokens,
                      total_tokens:
                        usageChat.total_tokens + usageSystem.total_tokens,
                    },
                    usageChat,
                    usageSystem,
                  },
                }),
              );
            } else if (output.response_metadata?.usage) {
              // Fallback to response_metadata for different model providers
              const normalized = normalizeUsageMetadata(
                output.response_metadata.usage,
              );
              if (isToolContext) {
                usageSystem.input_tokens += normalized.input_tokens;
                usageSystem.output_tokens += normalized.output_tokens;
                usageSystem.total_tokens += normalized.total_tokens;
              } else {
                usageChat.input_tokens += normalized.input_tokens;
                usageChat.output_tokens += normalized.output_tokens;
                usageChat.total_tokens += normalized.total_tokens;
              }
              console.log(
                'SimplifiedAgent: Collected usage from response_metadata:',
                normalized,
              );
              this.emitter.emit(
                'stats',
                JSON.stringify({
                  type: 'modelStats',
                  data: {
                    modelName: getModelName(this.chatLlm),
                    modelNameChat: getModelName(this.chatLlm),
                    modelNameSystem: getModelName(this.systemLlm),
                    usage: {
                      input_tokens:
                        usageChat.input_tokens + usageSystem.input_tokens,
                      output_tokens:
                        usageChat.output_tokens + usageSystem.output_tokens,
                      total_tokens:
                        usageChat.total_tokens + usageSystem.total_tokens,
                    },
                    usageChat,
                    usageSystem,
                  },
                }),
              );
            }
          }

          // Handle LLM end events for token usage tracking
          if (event.event === 'on_llm_end' && event.data.output) {
            const output = event.data.output;

            // Collect token usage from LLM end events
            if (output.llmOutput?.tokenUsage) {
              const normalized = normalizeUsageMetadata(
                output.llmOutput.tokenUsage,
              );
              // on_llm_end often corresponds to tool/internal chains; attribute to system usage
              usageSystem.input_tokens += normalized.input_tokens;
              usageSystem.output_tokens += normalized.output_tokens;
              usageSystem.total_tokens += normalized.total_tokens;
              console.log(
                'SimplifiedAgent: Collected usage from llmOutput:',
                normalized,
              );
              this.emitter.emit(
                'stats',
                JSON.stringify({
                  type: 'modelStats',
                  data: {
                    modelName: getModelName(this.chatLlm),
                    modelNameChat: getModelName(this.chatLlm),
                    modelNameSystem: getModelName(this.systemLlm),
                    usage: {
                      input_tokens:
                        usageChat.input_tokens + usageSystem.input_tokens,
                      output_tokens:
                        usageChat.output_tokens + usageSystem.output_tokens,
                      total_tokens:
                        usageChat.total_tokens + usageSystem.total_tokens,
                    },
                    usageChat,
                    usageSystem,
                  },
                }),
              );
            }
          }

          // Handle token-level streaming for the final response
          if (event.event === 'on_chat_model_stream' && event.data.chunk) {
            const chunk = event.data.chunk;
            if (chunk.content && typeof chunk.content === 'string') {
              // Add the token to our buffer
              currentResponseBuffer += chunk.content;

              // Emit the individual token
              this.emitResponse(chunk.content);
            }
          }
        }
      } catch (err: any) {
        if (
          this.retrievalSignal &&
          this.retrievalSignal.aborted &&
          isSoftStop(this.messageId || '')
        ) {
          // If respond-now was triggered, run a quick synthesis from collected context before finalization

          const docsString = collectedDocuments
            .map((doc: any, idx: number) => {
              const meta = doc?.metadata || {};
              const title = meta.title || meta.url || `Source ${idx + 1}`;
              const url = meta.url || '';
              const snippet = doc?.pageContent || '';
              return `<${idx + 1}>
<title>${title}</title>
${url ? `<url>${url}</url>` : ''}
<content>\n${snippet}\n</content>
</${idx + 1}>`;
            })
            .join('\n\n');

          const prompt = await ChatPromptTemplate.fromMessages([
            ['system', webSearchResponsePrompt],
            ['user', query],
          ]).partial({
            //recursionLimitReached: '',
            formattingAndCitations: this.personaInstructions
              ? this.personaInstructions
              : formattingAndCitationsWeb.content,
            //conversationHistory: '', //TODO: Pass recent history
            context: docsString || 'No context documents available.',
            date: formatDateForLLM(new Date()),
          });

          const chain = RunnableSequence.from([
            prompt,
            this.chatLlm,
          ]).withConfig({
            runName: 'SimplifiedRespondNowSynthesis',
            ...getLangfuseCallbacks(),
            signal: this.signal,
          });

          const eventStream2 = chain.streamEvents(
            { query },
            { version: 'v2', ...getLangfuseCallbacks() },
          );

          this.emitResponse(
            `## ⚠︎ Early response triggered by budget or user request. ⚠︎\nResponse may be incomplete, lack citations, or omit important content.\n\n---\n\n`,
          );

          for await (const event of eventStream2) {
            if (this.signal.aborted) break;
            if (event.event === 'on_chat_model_stream' && event.data?.chunk) {
              const chunk = event.data.chunk;
              if (chunk.content && typeof chunk.content === 'string') {
                currentResponseBuffer += chunk.content;
                this.emitResponse(chunk.content);
              }
            }
            if (event.event === 'on_chat_model_end' && event.data?.output) {
              const meta =
                event.data.output.usage_metadata ||
                event.data.output.response_metadata?.usage;
              if (meta) {
                const normalized = normalizeUsageMetadata(meta);
                usageChat.input_tokens += normalized.input_tokens;
                usageChat.output_tokens += normalized.output_tokens;
                usageChat.total_tokens += normalized.total_tokens;
              }
            }
            if (
              event.event === 'on_llm_end' &&
              (event.data?.output?.llmOutput?.tokenUsage ||
                event.data?.output?.estimatedTokenUsage)
            ) {
              const t =
                event.data.output.llmOutput?.tokenUsage ||
                event.data.output.estimatedTokenUsage;
              const normalized = normalizeUsageMetadata(t);
              usageChat.input_tokens += normalized.input_tokens;
              usageChat.output_tokens += normalized.output_tokens;
              usageChat.total_tokens += normalized.total_tokens;
            }
          }
        } else {
          throw err;
        }
      }

      // Emit the final sources used for the response
      if (collectedDocuments.length > 0) {
        this.emitter.emit(
          'data',
          JSON.stringify({
            type: 'sources',
            data: collectedDocuments,
            searchQuery: '',
            searchUrl: '',
          }),
        );
      }

      // If we didn't get any streamed tokens but have a final result, emit it
      if (
        currentResponseBuffer === '' &&
        finalResult &&
        finalResult.messages &&
        finalResult.messages.length > 0
      ) {
        const finalMessage =
          finalResult.messages[finalResult.messages.length - 1];

        if (finalMessage && finalMessage.content) {
          console.log('SimplifiedAgent: Emitting complete response (fallback)');

          this.emitResponse(finalMessage.content);
        }
      }

      // If we still have no response, emit a fallback message
      if (
        currentResponseBuffer === '' &&
        (!finalResult ||
          !finalResult.messages ||
          finalResult.messages.length === 0)
      ) {
        console.warn('SimplifiedAgent: No valid response found');
        this.emitResponse(
          'I apologize, but I was unable to generate a complete response to your query. Please try rephrasing your question or providing more specific details.',
        );
      }

      // Emit model stats and end signal after streaming is complete
      const modelNameChat = getModelName(this.chatLlm);
      const modelNameSystem = getModelName(this.systemLlm);
      console.log(
        'SimplifiedAgent: Usage collected — chat:',
        usageChat,
        'system:',
        usageSystem,
      );
      this.emitter.emit(
        'stats',
        JSON.stringify({
          type: 'modelStats',
          data: {
            modelName: modelNameChat, // legacy
            modelNameChat,
            modelNameSystem,
            usage: {
              input_tokens: usageChat.input_tokens + usageSystem.input_tokens,
              output_tokens:
                usageChat.output_tokens + usageSystem.output_tokens,
              total_tokens: usageChat.total_tokens + usageSystem.total_tokens,
            },
            usageChat,
            usageSystem,
          },
        }),
      );

      this.emitter.emit('end');
    } catch (error: any) {
      console.error('SimplifiedAgent: Error during search and answer:', error);

      // Handle specific error types
      if (this.signal.aborted) {
        console.warn('SimplifiedAgent: Operation was aborted');
        this.emitResponse('The search operation was cancelled.');
      } else {
        // General error handling
        this.emitResponse(
          'I encountered an error while processing your request. Please try rephrasing your query or contact support if the issue persists.',
        );
      }

      this.emitter.emit('end');
    }
  }

  /**
   * Get current configuration info
   */
  getInfo(): object {
    return {
      personaInstructions: !!this.personaInstructions,
    };
  }
}
