import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { Embeddings } from '@langchain/core/embeddings';
import { EventEmitter } from 'events';
import { RunnableConfig } from '@langchain/core/runnables';
import { SimplifiedAgentState } from '@/lib/state/chatAgentState';
import {
  allAgentTools,
  coreTools,
  webSearchTools,
  fileSearchTools,
} from '@/lib/tools/agents';
import { getModelName } from '../utils/modelUtils';
import { removeThinkingBlocksFromMessages } from '../utils/contentUtils';
import { getLangfuseCallbacks } from '@/lib/tracing/langfuse';
import { encodeHtmlAttribute } from '@/lib/utils/html';
import { buildChatPrompt } from '@/lib/prompts/simplifiedAgent/chat';
import { buildWebSearchPrompt } from '@/lib/prompts/simplifiedAgent/webSearch';
import { buildLocalResearchPrompt } from '@/lib/prompts/simplifiedAgent/localResearch';
import { buildFirefoxAIPrompt } from '@/lib/prompts/simplifiedAgent/firefoxAI';

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
  private embeddings: Embeddings;
  private emitter: EventEmitter;
  private personaInstructions: string;
  private signal: AbortSignal;
  private currentToolNames: string[] = [];

  constructor(
    chatLlm: BaseChatModel,
    systemLlm: BaseChatModel,
    embeddings: Embeddings,
    emitter: EventEmitter,
    personaInstructions: string = '',
    signal: AbortSignal,
  ) {
    this.chatLlm = chatLlm;
    this.systemLlm = systemLlm;
    this.embeddings = embeddings;
    this.emitter = emitter;
    this.personaInstructions = personaInstructions;
    this.signal = signal;
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
        },
        recursionLimit: 25, // Allow sufficient iterations for tool use
        signal: this.signal,
        ...getLangfuseCallbacks(),
      };

      // Use streamEvents to capture both tool calls and token-level streaming
      const eventStream = agent.streamEvents(initialState, {
        ...config,
        version: 'v2',
        ...getLangfuseCallbacks(),
      });

      let finalResult: any = null;
      let collectedDocuments: any[] = [];
      let currentResponseBuffer = '';
      // Separate usage trackers for chat (final answer) and system (tools/internal chains)
      let usageChat = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
      let usageSystem = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

      let initialMessageSent = false;

      // Process the event stream
      for await (const event of eventStream) {
        if (!initialMessageSent) {
          initialMessageSent = true;
          // If Firefox AI was detected, emit a special note
          if (firefoxAIDetected) {
            this.emitter.emit(
              'data',
              JSON.stringify({
                type: 'tool_call',
                data: {
                  content: '<ToolCall type="firefoxAI"></ToolCall>',
                },
              }),
            );
          }
        }

        // Handle different event types
        if (
          event.event === 'on_chain_end' &&
          event.name === 'RunnableSequence'
        ) {
          finalResult = event.data.output;
          // Collect relevant documents from the final result
          if (finalResult && finalResult.relevantDocuments) {
            collectedDocuments.push(...finalResult.relevantDocuments);
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
              }
            }
          }
        }

        // Handle streaming tool calls (for thought messages)
        if (event.event === 'on_chat_model_end' && event.data.output) {
          const output = event.data.output;
          const nameLower = (event.name || '').toLowerCase();
          console.log(`SimplifiedAgent: on_chat_model_end`, event);
          const isToolContext = output.tool_calls && output.tool_calls.length > 0;

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
                    input_tokens: usageChat.input_tokens + usageSystem.input_tokens,
                    output_tokens: usageChat.output_tokens + usageSystem.output_tokens,
                    total_tokens: usageChat.total_tokens + usageSystem.total_tokens,
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
                    input_tokens: usageChat.input_tokens + usageSystem.input_tokens,
                    output_tokens: usageChat.output_tokens + usageSystem.output_tokens,
                    total_tokens: usageChat.total_tokens + usageSystem.total_tokens,
                  },
                  usageChat,
                  usageSystem,
                },
              }),
            );
          }

          if (
            output._getType() === 'ai' &&
            output.tool_calls &&
            output.tool_calls.length > 0
          ) {
            const aiMessage = output as AIMessage;

            // Process each tool call and emit thought messages
            for (const toolCall of aiMessage.tool_calls || []) {
              if (toolCall && toolCall.name) {
                const toolName = toolCall.name;
                const toolArgs = toolCall.args || {};

                // Create user-friendly messages for different tools using markdown components
                let toolMarkdown = '';
                switch (toolName) {
                  case 'web_search':
                    toolMarkdown = `<ToolCall type=\"search\" query=\"${encodeHtmlAttribute(toolArgs.query || 'relevant information')}\"></ToolCall>`;
                    break;
                  case 'file_search':
                    toolMarkdown = `<ToolCall type=\"file\" query=\"${encodeHtmlAttribute(toolArgs.query || 'relevant information')}\"></ToolCall>`;
                    break;
                  case 'url_summarization':
                    if (Array.isArray(toolArgs.urls)) {
                      toolMarkdown = `<ToolCall type="url" count="${toolArgs.urls.length}"></ToolCall>`;
                    } else {
                      toolMarkdown = `<ToolCall type="url" count="1"></ToolCall>`;
                    }
                    break;
                  case 'image_search':
                    toolMarkdown = `<ToolCall type=\"image\" query=\"${encodeHtmlAttribute(toolArgs.query || 'relevant images')}\"></ToolCall>`;
                    break;
                  default:
                    toolMarkdown = `<ToolCall type="${toolName}"></ToolCall>`;
                }

                // Emit the thought message
                this.emitter.emit(
                  'data',
                  JSON.stringify({
                    type: 'tool_call',
                    data: {
                      content: toolMarkdown,
                    },
                  }),
                );
              }
            }
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
                    input_tokens: usageChat.input_tokens + usageSystem.input_tokens,
                    output_tokens: usageChat.output_tokens + usageSystem.output_tokens,
                    total_tokens: usageChat.total_tokens + usageSystem.total_tokens,
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
            this.emitter.emit(
              'data',
              JSON.stringify({
                type: 'response',
                data: chunk.content,
              }),
            );
          }
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

          this.emitter.emit(
            'data',
            JSON.stringify({
              type: 'response',
              data: finalMessage.content,
            }),
          );
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
        this.emitter.emit(
          'data',
          JSON.stringify({
            type: 'response',
            data: 'I apologize, but I was unable to generate a complete response to your query. Please try rephrasing your question or providing more specific details.',
          }),
        );
      }

      // Emit model stats and end signal after streaming is complete
      const modelNameChat = getModelName(this.chatLlm);
      const modelNameSystem = getModelName(this.systemLlm);
      console.log('SimplifiedAgent: Usage collected — chat:', usageChat, 'system:', usageSystem);
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
              output_tokens: usageChat.output_tokens + usageSystem.output_tokens,
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
      if (error.name === 'AbortError' || this.signal.aborted) {
        console.warn('SimplifiedAgent: Operation was aborted');
        this.emitter.emit(
          'data',
          JSON.stringify({
            type: 'response',
            data: 'The search operation was cancelled.',
          }),
        );
      } else {
        // General error handling
        this.emitter.emit(
          'data',
          JSON.stringify({
            type: 'response',
            data: 'I encountered an error while processing your request. Please try rephrasing your query or contact support if the issue persists.',
          }),
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
