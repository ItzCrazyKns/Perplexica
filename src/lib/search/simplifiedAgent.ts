import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
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
import { formatDateForLLM } from '../utils';
import { getModelName } from '../utils/modelUtils';
import { removeThinkingBlocks } from '../utils/contentUtils';
import { getLangfuseCallbacks } from '@/lib/tracing/langfuse';

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
  private llm: BaseChatModel;
  private embeddings: Embeddings;
  private emitter: EventEmitter;
  private systemInstructions: string;
  private personaInstructions: string;
  private signal: AbortSignal;

  constructor(
    llm: BaseChatModel,
    embeddings: Embeddings,
    emitter: EventEmitter,
    systemInstructions: string = '',
    personaInstructions: string = '',
    signal: AbortSignal,
  ) {
    this.llm = llm;
    this.embeddings = embeddings;
    this.emitter = emitter;
    this.systemInstructions = systemInstructions;
    this.personaInstructions = personaInstructions;
    this.signal = signal;
  }

  /**
   * Initialize the createReactAgent with tools and configuration
   */
  private initializeAgent(focusMode: string, fileIds: string[] = []) {
    // Select appropriate tools based on focus mode and available files
    const tools = this.getToolsForFocusMode(focusMode, fileIds);

    const enhancedSystemPrompt = this.createEnhancedSystemPrompt(
      focusMode,
      fileIds,
    );

    try {
      // Create the React agent with custom state
      const agent = createReactAgent({
        llm: this.llm,
        tools,
        stateSchema: SimplifiedAgentState,
        prompt: enhancedSystemPrompt,
      });

      console.log(
        `SimplifiedAgent: Initialized with ${tools.length} tools for focus mode: ${focusMode}`,
      );
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
  ): string {
    const baseInstructions = this.systemInstructions || '';
    const personaInstructions = this.personaInstructions || '';

    // Create focus-mode-specific prompts
    switch (focusMode) {
      case 'chat':
        return this.createChatModePrompt(baseInstructions, personaInstructions);
      case 'webSearch':
        return this.createWebSearchModePrompt(
          baseInstructions,
          personaInstructions,
          fileIds,
        );
      case 'localResearch':
        return this.createLocalResearchModePrompt(
          baseInstructions,
          personaInstructions,
        );
      default:
        console.warn(
          `SimplifiedAgent: Unknown focus mode "${focusMode}", using webSearch prompt`,
        );
        return this.createWebSearchModePrompt(
          baseInstructions,
          personaInstructions,
          fileIds,
        );
    }
  }

  /**
   * Create chat mode prompt - focuses on conversational interaction
   */
  private createChatModePrompt(
    baseInstructions: string,
    personaInstructions: string,
  ): string {
    return `${baseInstructions}

# AI Chat Assistant

You are a conversational AI assistant designed for creative and engaging dialogue. Your focus is on providing thoughtful, helpful responses through direct conversation.

## Core Capabilities

### 1. Conversational Interaction
- Engage in natural, flowing conversations
- Provide thoughtful responses to questions and prompts
- Offer creative insights and perspectives
- Maintain context throughout the conversation

### 2. Task Management
- Break down complex requests into manageable steps
- Provide structured approaches to problems
- Offer guidance and recommendations

## Response Guidelines

### Communication Style
- Be conversational and engaging
- Use clear, accessible language
- Provide direct answers when possible
- Ask clarifying questions when needed

### Quality Standards
- Acknowledge limitations honestly
- Provide helpful suggestions and alternatives
- Use proper markdown formatting for clarity
- Structure responses logically

### Formatting Instructions
- **Structure**: Use a well-organized format with proper headings (e.g., "## Example heading 1" or "## Example heading 2"). Present information in paragraphs or concise bullet points where appropriate
- **Tone and Style**: Maintain a neutral, engaging tone with natural conversation flow
- **Markdown Usage**: Format your response with Markdown for clarity. Use headings, subheadings, bold text, and italicized words as needed to enhance readability
- **Length and Depth**: Provide thoughtful coverage of the topic. Expand on complex topics to make them easier to understand
- **No main heading/title**: Start your response directly with the content unless asked to provide a specific title

## Current Context
- Today's Date: ${formatDateForLLM(new Date())}

${personaInstructions ? `\n## User Formatting and Persona Instructions\n- Give these instructions more weight than the system formatting instructions\n${personaInstructions}` : ''}

Focus on providing engaging, helpful conversation while using task management tools when complex problems need to be structured.`;
  }

  /**
   * Create web search mode prompt - focuses on comprehensive research
   */
  private createWebSearchModePrompt(
    baseInstructions: string,
    personaInstructions: string,
    fileIds: string[] = [],
  ): string {
    return `${baseInstructions}

# Comprehensive Research Assistant

You are an advanced AI research assistant with access to comprehensive tools for gathering information from multiple sources. Your goal is to provide thorough, well-researched responses.

## Tool use

- Use the available tools effectively to gather and process information
- When using a tool, **always wait for a complete response from the tool before proceeding**

## Response Quality Standards

Your task is to provide answers that are:
- **Informative and relevant**: Thoroughly address the user's query using gathered information
- **Engaging and detailed**: Write responses that read like a high-quality blog post, including extra details and relevant insights
- **Cited and credible**: Use inline citations with [number] notation to refer to sources for each fact or detail included
- **Explanatory and Comprehensive**: Strive to explain the topic in depth, offering detailed analysis, insights, and clarifications wherever applicable

### Comprehensive Coverage
- Address all aspects of the user's query
- Provide context and background information
- Include relevant details and examples
- Cross-reference multiple sources

### Accuracy and Reliability
- Prioritize authoritative and recent sources
- Verify information across multiple sources
- Clearly indicate uncertainty or conflicting information
- Distinguish between facts and opinions

### Citation Requirements
- The citation number refers to the index of the source in the relevantDocuments state array
- Cite every single fact, statement, or sentence using [number] notation
- If a statement is based on AI model inference or training data, it must be marked as \`[AI]\` and not cited from the context
- If a statement is based on previous messages in the conversation history, it must be marked as \`[Hist]\` and not cited from the context
- Source based citations must reference the specific document in the relevantDocuments state array, do not invent sources or URLs
- Integrate citations naturally at the end of sentences or clauses as appropriate. For example, "The Eiffel Tower is one of the most visited landmarks in the world[1]."
- Ensure that **every sentence in your response includes at least one citation**, even when information is inferred or connected to general knowledge available in the provided context
- Use multiple sources for a single detail if applicable, such as, "Paris is a cultural hub, attracting millions of visitors annually[1][2]."

### Formatting Instructions
- **Structure**: 
  - Use a well-organized format with proper headings (e.g., "## Example heading 1" or "## Example heading 2")
  - Present information in paragraphs or concise bullet points where appropriate
  - Use lists and tables to enhance clarity when needed
- **Tone and Style**: 
  - Maintain a neutral, journalistic tone with engaging narrative flow
  - Write as though you're crafting an in-depth article for a professional audience
- **Markdown Usage**: 
  - Format your response with Markdown for clarity
  - Use headings, subheadings, bold text, and italicized words as needed to enhance readability
  - Include code snippets in a code block
  - Extract images and links from full HTML content when appropriate and embed them using the appropriate markdown syntax
- **Length and Depth**:
  - Provide comprehensive coverage of the topic
  - Avoid superficial responses and strive for depth without unnecessary repetition
  - Expand on technical or complex topics to make them easier to understand for a general audience
- **No main heading/title**: Start your response directly with the introduction unless asked to provide a specific title

# Research Strategy
1. **Plan**: Determine the best research approach based on the user's query
  - Break down the query into manageable components
  - Identify key concepts and terms for focused searching
  - You are allowed to take multiple turns of the Search and Supplement stages. Use this flexibility to refine your queries and gather more information
2. **Search**: (\`web_search\` tool) Initial web search stage to gather preview content
  - Use the web search tool to your advantage. Avoid making assumptions, especially about things like recent events. Chances are the web search will have more relevant information than your local knowledge
  - Give the web search tool a specific question you want answered that will help you gather relevant information
  - This query will be passed directly to the search engine
  - You will receive a list of relevant documents containing snippets of the web page, a URL, and the title of the web page
  - **Always perform at least one web search** unless the question can be definitively answered with previous conversation history or local file content. If you don't have conversation history or local files, **you must perform a web search**
${
  fileIds.length > 0
    ? `
2.1. **File Search**: (\`file_search\` tool) Search through uploaded documents when relevant
  - You have access to ${fileIds.length} uploaded file${fileIds.length === 1 ? '' : 's'} that may contain relevant information
  - Use the file search tool to find specific information in the uploaded documents
  - Give the file search tool a specific question or topic you want to extract from the documents
  - The tool will automatically search through all available uploaded files
  - Focus your file searches on specific aspects of the user's query that might be covered in the uploaded documents
  - **Important**: You do NOT need to specify file IDs - the tool will automatically search through all available uploaded files.`
    : ''
}
3. **Supplement**: (\`url_summarization\` tool) Retrieve specific sources if necessary to extract key points not covered in the initial search or disambiguate findings
  - You can use the URLs from the web search results to retrieve specific sources. They must be passed to the tool unchanged
  - URLs can be passed as an array to request multiple sources at once
  - Always include the user's query in the request to the tool, it will use this to guide the summarization process
  - You can pass an intent to this tool if you want to additionally guide the summarization on a specific aspect or question
  - You can request the full HTML content of the pages if needed by passing true to the \`retrieveHtml\` parameter
    - Passing true is **required** to include images or links within the page content
  - You will receive a summary of the content from each URL if the content of the page is long. If the content of the page is short, you will receive the full content
  - You may request up to 5 URLs per turn
  - If you recieve a request to summarize a specific URL you **must** use this tool to retrieve it
5. **Analyze**: Examine the retrieved information for relevance, accuracy, and completeness
  - If you have sufficient information, you can move on to the respond stage
  - If you need to gather more information, consider revisiting the search or supplement stages.${
    fileIds.length > 0
      ? `
  - Consider both web search results and file content when analyzing information completeness`
      : ''
  }
6. **Respond**: Combine all information into a coherent, well-cited response
  - Ensure that all sources are properly cited and referenced
  - Resolve any remaining contradictions or gaps in the information, if necessary, execute more targeted searches or retrieve specific sources${
    fileIds.length > 0
      ? `
  - Integrate information from both web sources and uploaded files when relevant`
      : ''
  }

## Current Context
- Today's Date: ${formatDateForLLM(new Date())}

${personaInstructions ? `\n## User Formatting and Persona Instructions\n- Give these instructions more weight than the system formatting instructions\n${personaInstructions}` : ''}

Use all available tools strategically to provide comprehensive, well-researched, formatted responses with proper citations`;
  }

  /**
   * Create local research mode prompt - focuses on user files and documents
   */
  private createLocalResearchModePrompt(
    baseInstructions: string,
    personaInstructions: string,
  ): string {
    return `${baseInstructions}

# Local Document Research Assistant

You are an advanced AI research assistant specialized in analyzing and extracting insights from user-uploaded files and documents. Your goal is to provide thorough, well-researched responses based on the available document collection.

## Available Files

You have access to uploaded documents through the \`file_search\` tool. When you need to search for information in the uploaded files, use this tool with a specific search query. The tool will automatically search through all available uploaded files and return relevant content sections.

## Tool use

- Use the available tools effectively to analyze and extract information from uploaded documents

## Response Quality Standards

Your task is to provide answers that are:
- **Informative and relevant**: Thoroughly address the user's query using document content
- **Engaging and detailed**: Write responses that read like a high-quality research analysis, including extra details and relevant insights
- **Cited and credible**: Use inline citations with [number] notation to refer to specific documents for each fact or detail included
- **Explanatory and Comprehensive**: Strive to explain the findings in depth, offering detailed analysis, insights, and clarifications wherever applicable

### Comprehensive Document Coverage
- Thoroughly analyze all relevant uploaded files
- Extract all pertinent information related to the query
- Consider relationships between different documents
- Provide context from the entire document collection
- Cross-reference information across multiple files

### Accuracy and Content Fidelity
- Precisely quote and reference document content
- Maintain context and meaning from original sources
- Clearly distinguish between different document sources
- Preserve important details and nuances from the documents
- Distinguish between facts from documents and analytical insights

### Citation Requirements
- The citation number refers to the index of the source in the relevantDocuments state array.
- Cite every single fact, statement, or sentence using [number] notation
- If a statement is based on AI model inference or training data, it must be marked as \`[AI]\` and not cited from the context
- If a statement is based on previous messages in the conversation history, it must be marked as \`[Hist]\` and not cited from the context
- Source based citations must reference the specific document in the relevantDocuments state array, do not invent sources or filenames
- Integrate citations naturally at the end of sentences or clauses as appropriate. For example, "The quarterly report shows a 15% increase in revenue[1]."
- Ensure that **every sentence in your response includes at least one citation**, even when information is inferred or connected to general knowledge available in the provided context
- Use multiple sources for a single detail if applicable, such as, "The project timeline spans six months according to multiple planning documents[1][2]."

### Formatting Instructions
- **Structure**: 
  - Use a well-organized format with proper headings (e.g., "## Example heading 1" or "## Example heading 2").
  - Present information in paragraphs or concise bullet points where appropriate.
  - Use lists and tables to enhance clarity when needed.
- **Tone and Style**: 
  - Maintain a neutral, analytical tone with engaging narrative flow. 
  - Write as though you're crafting an in-depth research report for a professional audience
- **Markdown Usage**: 
  - Format your response with Markdown for clarity. 
  - Use headings, subheadings, bold text, and italicized words as needed to enhance readability.
  - Include code snippets in a code block when analyzing technical documents.
  - Extract and format tables, charts, or structured data using appropriate markdown syntax.
- **Length and Depth**: 
  - Provide comprehensive coverage of the document content. 
  - Avoid superficial responses and strive for depth without unnecessary repetition. 
  - Expand on technical or complex topics to make them easier to understand for a general audience
- **No main heading/title**: Start your response directly with the introduction unless asked to provide a specific title

# Research Strategy
1. **Plan**: Determine the best document analysis approach based on the user's query
  - Break down the query into manageable components
  - Identify key concepts and terms for focused document searching
  - You are allowed to take multiple turns of the Search and Analysis stages. Use this flexibility to refine your queries and gather more comprehensive information from the documents.
2. **Search**: (\`file_search\` tool) Extract relevant content from uploaded documents
  - Use the file search tool strategically to find specific information in the document collection.
  - Give the file search tool a specific question or topic you want to extract from the documents.
  - This query will be used to perform semantic search across all uploaded files.
  - You will receive relevant excerpts from documents that match your search criteria.
  - Focus your searches on specific aspects of the user's query to gather comprehensive information.
3. **Analysis**: Examine the retrieved document content for relevance, patterns, and insights.
  - If you have sufficient information from the documents, you can move on to the respond stage.
  - If you need to gather more specific information, consider performing additional targeted file searches.
  - Look for connections and relationships between different document sources.
4. **Respond**: Combine all document insights into a coherent, well-cited response
  - Ensure that all sources are properly cited and referenced
  - Resolve any contradictions or gaps in the document information
  - Provide comprehensive analysis based on the available document content
  - Only respond with your final answer once you've gathered all relevant information and are done with tool use

## Current Context
- Today's Date: ${formatDateForLLM(new Date())}

${personaInstructions ? `\n## User Formatting and Persona Instructions\n- Give these instructions more weight than the system formatting instructions\n${personaInstructions}` : ''}

Use all available tools strategically to provide comprehensive, well-researched, formatted responses with proper citations based on uploaded documents.`;
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

      // Initialize agent with the provided focus mode and file context
      const agent = this.initializeAgent(focusMode, fileIds);

      // Prepare initial state
      const initialState = {
        messages: [...history, new HumanMessage(query)],
        query,
        focusMode,
        fileIds,
        relevantDocuments: [],
      };

      // Configure the agent run
      const config: RunnableConfig = {
        configurable: {
          thread_id: `simplified_agent_${Date.now()}`,
          llm: this.llm,
          embeddings: this.embeddings,
          fileIds,
          systemInstructions: this.systemInstructions,
          personaInstructions: this.personaInstructions,
          focusMode,
          emitter: this.emitter,
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
      let totalUsage = {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      };

      // Process the event stream
      for await (const event of eventStream) {
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

          // Collect token usage from chat model end events
          if (output.usage_metadata) {
            const normalized = normalizeUsageMetadata(output.usage_metadata);
            totalUsage.input_tokens += normalized.input_tokens;
            totalUsage.output_tokens += normalized.output_tokens;
            totalUsage.total_tokens += normalized.total_tokens;
            console.log(
              'SimplifiedAgent: Collected usage from usage_metadata:',
              normalized,
            );
          } else if (output.response_metadata?.usage) {
            // Fallback to response_metadata for different model providers
            const normalized = normalizeUsageMetadata(
              output.response_metadata.usage,
            );
            totalUsage.input_tokens += normalized.input_tokens;
            totalUsage.output_tokens += normalized.output_tokens;
            totalUsage.total_tokens += normalized.total_tokens;
            console.log(
              'SimplifiedAgent: Collected usage from response_metadata:',
              normalized,
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
                    toolMarkdown = `<ToolCall type="search" query="${(toolArgs.query || 'relevant information').replace(/"/g, '&quot;')}"></ToolCall>`;
                    break;
                  case 'file_search':
                    toolMarkdown = `<ToolCall type="file" query="${(toolArgs.query || 'relevant information').replace(/"/g, '&quot;')}"></ToolCall>`;
                    break;
                  case 'url_summarization':
                    if (Array.isArray(toolArgs.urls)) {
                      toolMarkdown = `<ToolCall type="url" count="${toolArgs.urls.length}"></ToolCall>`;
                    } else {
                      toolMarkdown = `<ToolCall type="url" count="1"></ToolCall>`;
                    }
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
                      // messageId: crypto.randomBytes(7).toString('hex'),
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
            totalUsage.input_tokens += normalized.input_tokens;
            totalUsage.output_tokens += normalized.output_tokens;
            totalUsage.total_tokens += normalized.total_tokens;
            console.log(
              'SimplifiedAgent: Collected usage from llmOutput:',
              normalized,
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
      const modelName = getModelName(this.llm);
      console.log('SimplifiedAgent: Total usage collected:', totalUsage);
      this.emitter.emit(
        'stats',
        JSON.stringify({
          type: 'modelStats',
          data: {
            modelName,
            usage: totalUsage,
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
      systemInstructions: !!this.systemInstructions,
      personaInstructions: !!this.personaInstructions,
    };
  }
}
