import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
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

/**
 * Simplified Agent using createReactAgent
 *
 * This agent replaces the complex LangGraph supervisor pattern with a single
 * tool-calling agent that handles analysis and synthesis internally while
 * using specialized tools for search, file processing, and URL summarization.
 */
export class SimplifiedAgent {
  private llm: BaseChatModel;
  private embeddings: Embeddings;
  private emitter: EventEmitter;
  private systemInstructions: string;
  private personaInstructions: string;
  private signal: AbortSignal;
  private focusMode: string;
  private agent: any; // Will be the compiled createReactAgent

  constructor(
    llm: BaseChatModel,
    embeddings: Embeddings,
    emitter: EventEmitter,
    systemInstructions: string = '',
    personaInstructions: string = '',
    signal: AbortSignal,
    focusMode: string = 'webSearch',
  ) {
    this.llm = llm;
    this.embeddings = embeddings;
    this.emitter = emitter;
    this.systemInstructions = systemInstructions;
    this.personaInstructions = personaInstructions;
    this.signal = signal;
    this.focusMode = focusMode;

    // Initialize the agent
    this.initializeAgent();
  }

  /**
   * Initialize the createReactAgent with tools and configuration
   */
  private initializeAgent() {
    // Select appropriate tools based on focus mode
    const tools = this.getToolsForFocusMode(this.focusMode);

    // Create the enhanced system prompt that includes analysis and synthesis instructions
    const enhancedSystemPrompt = this.createEnhancedSystemPrompt();

    try {
      // Create the React agent with custom state
      this.agent = createReactAgent({
        llm: this.llm,
        tools,
        stateSchema: SimplifiedAgentState,
        prompt: enhancedSystemPrompt,
      });

      console.log(
        `SimplifiedAgent: Initialized with ${tools.length} tools for focus mode: ${this.focusMode}`,
      );
      console.log(
        `SimplifiedAgent: Tools available: ${tools.map((tool) => tool.name).join(', ')}`,
      );
    } catch (error) {
      console.error('SimplifiedAgent: Error initializing agent:', error);
      throw error;
    }
  }

  /**
   * Get tools based on focus mode
   */
  private getToolsForFocusMode(focusMode: string) {
    switch (focusMode) {
      case 'chat':
        // Chat mode: Only core tools for conversational interaction
        return coreTools;
      case 'webSearch':
        // Web search mode: ALL available tools for comprehensive research
        return allAgentTools;
      case 'localResearch':
        // Local research mode: File search tools + core tools
        return [...coreTools, ...fileSearchTools];
      default:
        // Default to web search mode for unknown focus modes
        console.warn(
          `SimplifiedAgent: Unknown focus mode "${focusMode}", defaulting to webSearch tools`,
        );
        return allAgentTools;
    }
  }

  /**
   * Create enhanced system prompt that includes analysis and synthesis capabilities
   */
  private createEnhancedSystemPrompt(): string {
    const baseInstructions = this.systemInstructions || '';
    const personaInstructions = this.personaInstructions || '';

    // Create focus-mode-specific prompts
    switch (this.focusMode) {
      case 'chat':
        return this.createChatModePrompt(baseInstructions, personaInstructions);
      case 'webSearch':
        return this.createWebSearchModePrompt(
          baseInstructions,
          personaInstructions,
        );
      case 'localResearch':
        return this.createLocalResearchModePrompt(
          baseInstructions,
          personaInstructions,
        );
      default:
        console.warn(
          `SimplifiedAgent: Unknown focus mode "${this.focusMode}", using webSearch prompt`,
        );
        return this.createWebSearchModePrompt(
          baseInstructions,
          personaInstructions,
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
  ): string {
    return `${baseInstructions}

# Comprehensive Research Assistant

You are an advanced AI research assistant with access to comprehensive tools for gathering information from multiple sources. Your goal is to provide thorough, well-researched responses.

**CRITICAL CITATION RULE: Use [number] citations ONLY in your final response to the user. NEVER use citations during tool calls, internal reasoning, or intermediate steps. Citations are for the final answer only.**

**WORKFLOW RULE: Use tools to gather information, then provide your final response directly. Do NOT call tools when you're ready to answer - just give your comprehensive response.**

## Core Responsibilities

### 1. Query Analysis and Planning
- Analyze user queries to understand research needs
- Break down complex questions into research tasks
- Determine the best research strategy and tools
- Plan comprehensive information gathering

### 2. Information Gathering
- Search the web for current and authoritative information
- Process and extract content from URLs
- Access and analyze uploaded files when relevant
- Gather information from multiple sources for completeness

### 3. Analysis and Synthesis
- Analyze gathered information for relevance and accuracy
- Synthesize information from multiple sources
- Identify patterns, connections, and insights
- Resolve conflicting information when present
- Generate comprehensive, well-cited responses

## Available Tools

### Web Search
- Use \`web_search\` for current information, facts, and general research
- Primary tool for finding authoritative sources and recent information
- Always call this tool at least once unless you have sufficient information from the conversation history or other more relevant tools

### File Search
- Use \`file_search\` when users have uploaded files or reference local content
- Extracts and processes relevant content from user documents
- Connects local content with external research

### URL Summarization
- Use \`url_summarization\` when specific URLs are provided or discovered
- Extracts key information and generates summaries from web content
- Use when detailed content analysis is needed
- Can help provide more context based on web search results to disambiguate or clarify findings

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
- **CRITICAL: Citations are ONLY for your final response to the user, NOT for tool calls or internal reasoning**
- The id of the source can be found in the document \`metadata.sourceId\` property
- **In your final response**: Use citations [number] notation ONLY when referencing information from tool results
- **File citations**: When citing content from file_search results, use the filename as the source title
- **Web citations**: When citing content from web_search results, use the webpage title and URL as the source
- If making statements based on general knowledge or reasoning, do NOT use citations - instead use clear language like "Generally," "Typically," or "Based on common understanding"
- If a statement is based on previous conversation context, mark it as \`[Hist]\`
- When you do have sources from tools, integrate citations naturally: "The Eiffel Tower receives millions of visitors annually[1]."
- **Important**: Do not fabricate or assume citation numbers - only cite actual sources from your tool results
- **Tool Usage**: When calling tools, provide clear queries without citations - citations come later in your final response

### Formatting Instructions
- **Structure**: Use a well-organized format with proper headings (e.g., "## Example heading 1" or "## Example heading 2"). Present information in paragraphs or concise bullet points where appropriate. Use lists and tables to enhance clarity when needed.
- **Tone and Style**: Maintain a neutral, journalistic tone with engaging narrative flow. Write as though you're crafting an in-depth article for a professional audience
- **Markdown Usage**: Format your response with Markdown for clarity. Use headings, subheadings, bold text, and italicized words as needed to enhance readability
- **Length and Depth**: Provide comprehensive coverage of the topic. Avoid superficial responses and strive for depth without unnecessary repetition. Expand on technical or complex topics to make them easier to understand for a general audience
- **No main heading/title**: Start your response directly with the introduction unless asked to provide a specific title

## Research Strategy
1. **Plan**: Determine the best research approach based on the user's query
2. **Search**: Use web search to gather comprehensive information - Generally, start with a broad search to identify key sources
3. **Supplement**: Use URL summarization for specific sources
4. **Integrate**: Include file search results when user files are relevant
5. **Synthesize**: Combine all information into a coherent, well-cited response

## Current Context
- Today's Date: ${formatDateForLLM(new Date())}

${personaInstructions ? `\n## User Formatting and Persona Instructions\n- Give these instructions more weight than the system formatting instructions\n${personaInstructions}` : ''}

Use all available tools strategically to provide comprehensive, well-researched responses with proper citations and source attribution.`;
  }

  /**
   * Create local research mode prompt - focuses on user files and documents
   */
  private createLocalResearchModePrompt(
    baseInstructions: string,
    personaInstructions: string,
  ): string {
    return `${baseInstructions}

# Local Research Specialist

You are an expert AI assistant specialized in analyzing and researching local files and documents. Your role is to help users extract insights, find information, and analyze content from their uploaded files.

**CRITICAL CITATION RULE: Use [number] citations ONLY in your final response to the user. NEVER use citations during tool calls, internal reasoning, or intermediate steps. Citations are for the final answer only.**

**WORKFLOW RULE: Use tools to gather information, then provide your final response directly. Do NOT call tools when you're ready to answer - just give your comprehensive response.**

## Core Responsibilities

### 1. Document Analysis
- Analyze user-uploaded files and documents
- Extract relevant information based on user queries
- Understand document structure and content relationships
- Identify key themes, patterns, and insights

### 2. Content Synthesis
- Synthesize information from multiple user documents
- Connect related concepts across different files
- Generate comprehensive insights from local content
- Provide context-aware responses based on document analysis

### 3. Task Management
- Break down complex document analysis requests
- Structure multi-document research projects
- Organize findings in logical, accessible formats

## Available Tools

### File Search
- Use \`file_search\` to process and analyze user-uploaded files
- Primary tool for extracting relevant content from documents
- Performs semantic search across uploaded content
- Handles various file formats and document types

## Response Quality Standards

Your task is to provide answers that are:
- **Informative and relevant**: Thoroughly address the user's query using document content
- **Engaging and detailed**: Write responses that read like a high-quality analysis, including extra details and relevant insights
- **Cited and credible**: Use inline citations with [number] notation to refer to specific documents for each fact or detail included
- **Explanatory and Comprehensive**: Strive to explain the findings in depth, offering detailed analysis, insights, and clarifications wherever applicable

### Comprehensive Document Coverage
- Thoroughly analyze relevant uploaded files
- Extract all pertinent information related to the query
- Consider relationships between different documents
- Provide context from the document collection

### Accurate Content Extraction
- Precisely quote and reference document content
- Maintain context and meaning from original sources
- Clearly distinguish between different document sources
- Preserve important details and nuances

### Citation Requirements
- **CRITICAL: Citations are ONLY for your final response to the user, NOT for tool calls or internal reasoning**
- **During tool usage**: Do not use any [number] citations in tool calls or internal reasoning
- **In your final response**: Use citations [number] notation ONLY when referencing information from file_search tool results
- **File citations**: When citing content from file_search results, use the filename as the source title
- If making statements based on general knowledge or reasoning, do NOT use citations - instead use clear language like "Generally," "Typically," or "Based on common understanding"
- If a statement is based on previous conversation context, mark it as \`[Hist]\`
- When you do have sources from tools, integrate citations naturally: "The project timeline shows completion by March 2024[1]."
- Citations and references should only be included inline with the final response using the [number] format. Do not include a citation, sources, or references block anywhere else in the response
- **Important**: Do not fabricate or assume citation numbers - only cite actual sources from your file search results
- **Tool Usage**: When calling tools, provide clear queries without citations - citations come later in your final response

### Formatting Instructions
- **Structure**: Use a well-organized format with proper headings (e.g., "## Example heading 1" or "## Example heading 2"). Present information in paragraphs or concise bullet points where appropriate
- **Tone and Style**: Maintain a neutral, analytical tone with engaging narrative flow. Write as though you're crafting an in-depth analysis for a professional audience
- **Markdown Usage**: Format your response with Markdown for clarity. Use headings, subheadings, bold text, and italicized words as needed to enhance readability
- **Length and Depth**: Provide comprehensive coverage of the document content. Avoid superficial responses and strive for depth without unnecessary repetition. Expand on technical or complex topics to make them easier to understand for a general audience
- **No main heading/title**: Start your response directly with the introduction unless asked to provide a specific title

### Contextual Understanding
- Understand how documents relate to each other
- Connect information across multiple files
- Identify patterns and themes in the document collection
- Provide insights that consider the full context

## Research Approach
1. **Plan**: Use task manager to structure complex document analysis
2. **Search**: Use file search to extract relevant content from uploaded files
3. **Analyze**: Process and understand the extracted information
4. **Synthesize**: Combine insights from multiple sources
5. **Present**: Organize findings in a clear, accessible format with proper citations

**IMPORTANT**: Once you have gathered sufficient information through tools, provide your final response directly to the user. Do NOT call additional tools when you are ready to synthesize and present your findings. Your final response should be comprehensive and well-formatted.

## Current Context
- Today's Date: ${formatDateForLLM(new Date())}

${personaInstructions ? `\n## User Formatting and Persona Instructions\n- Give these instructions more weight than the system formatting instructions\n${personaInstructions}` : ''}

Focus on extracting maximum value from user-provided documents while using task management for complex analysis projects.`;
  }

  /**
   * Execute the simplified agent workflow
   */
  async searchAndAnswer(
    query: string,
    history: BaseMessage[] = [],
    fileIds: string[] = [],
  ): Promise<void> {
    try {
      console.log(`SimplifiedAgent: Starting search for query: "${query}"`);
      console.log(`SimplifiedAgent: Focus mode: ${this.focusMode}`);
      console.log(`SimplifiedAgent: File IDs: ${fileIds.join(', ')}`);

      // Emit initial agent action
      this.emitter.emit(
        'data',
        JSON.stringify({
          type: 'agent_action',
          data: {
            action: 'simplified_agent_start',
            message: `Starting simplified agent search in ${this.focusMode} mode`,
            details: `Processing query with ${fileIds.length} files available`,
          },
        }),
      );

      // Prepare initial state
      const initialState = {
        messages: [...history, new HumanMessage(query)],
        query,
        focusMode: this.focusMode,
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
          focusMode: this.focusMode,
          emitter: this.emitter,
        },
        recursionLimit: 25, // Allow sufficient iterations for tool use
        signal: this.signal,
      };

      // Execute the agent
      const result = await this.agent.invoke(initialState, config);

      // Collect relevant documents from tool execution history
      let collectedDocuments: any[] = [];

      // Get the relevant docs from the current agent state
      if (result && result.relevantDocuments) {
        collectedDocuments.push(...result.relevantDocuments);
      }

      // // Check if messages contain tool responses with documents
      // if (result && result.messages) {
      //   for (const message of result.messages) {
      //     if (message._getType() === 'tool' && message.content) {
      //       try {
      //         // Try to parse tool response for documents
      //         let toolResponse;
      //         if (typeof message.content === 'string') {
      //           toolResponse = JSON.parse(message.content);
      //         } else {
      //           toolResponse = message.content;
      //         }

      //         if (toolResponse.documents && Array.isArray(toolResponse.documents)) {
      //           const documentsWithMetadata = toolResponse.documents.map((doc: any) => ({
      //             ...doc,
      //             source: doc.metadata?.url || doc.metadata?.source || 'unknown',
      //             sourceType: doc.metadata?.sourceType || 'unknown',
      //             toolName: message.name || 'unknown',
      //             processingType: doc.metadata?.processingType || 'unknown',
      //             searchQuery: doc.metadata?.searchQuery || '',
      //           }));
      //           collectedDocuments.push(...documentsWithMetadata);
      //         }
      //       } catch (error) {
      //         // Ignore parsing errors
      //         console.debug('Could not parse tool message content:', error);
      //       }
      //     }
      //   }
      // }

      // Add collected documents to result for source tracking
      const finalResult = {
        ...result,
        relevantDocuments: collectedDocuments,
      };

      // Extract final message and emit as response
      if (
        finalResult &&
        finalResult.messages &&
        finalResult.messages.length > 0
      ) {
        const finalMessage =
          finalResult.messages[finalResult.messages.length - 1];

        if (finalMessage && finalMessage.content) {
          console.log('SimplifiedAgent: Emitting final response');

          // Emit the sources used for the response
          if (
            finalResult.relevantDocuments &&
            finalResult.relevantDocuments.length > 0
          ) {
            this.emitter.emit(
              'data',
              JSON.stringify({
                type: 'sources',
                data: finalResult.relevantDocuments,
                searchQuery: '',
                searchUrl: '',
              }),
            );
          }

          this.emitter.emit(
            'data',
            JSON.stringify({
              type: 'response',
              data: finalMessage.content,
            }),
          );
        } else {
          console.warn('SimplifiedAgent: No valid final message found');
          this.emitter.emit(
            'data',
            JSON.stringify({
              type: 'response',
              data: 'I apologize, but I was unable to generate a complete response to your query. Please try rephrasing your question or providing more specific details.',
            }),
          );
        }
      } else {
        console.warn('SimplifiedAgent: No result messages found');
        this.emitter.emit(
          'data',
          JSON.stringify({
            type: 'response',
            data: 'I encountered an issue while processing your request. Please try again with a different query.',
          }),
        );
      }

      // Emit model stats and end signal after streaming is complete
      const modelName = getModelName(this.llm);
      this.emitter.emit(
        'stats',
        JSON.stringify({
          type: 'modelStats',
          data: { modelName },
        }),
      );

      this.emitter.emit('end');
    } catch (error: any) {
      console.error('SimplifiedAgent: Error during search and answer:', error);

      // Handle specific error types
      if (error.name === 'AbortError') {
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
   * Update focus mode and reinitialize agent with appropriate tools
   */
  updateFocusMode(newFocusMode: string): void {
    if (this.focusMode !== newFocusMode) {
      console.log(
        `SimplifiedAgent: Updating focus mode from ${this.focusMode} to ${newFocusMode}`,
      );
      this.focusMode = newFocusMode;
      this.initializeAgent();
    }
  }

  /**
   * Get current configuration info
   */
  getInfo(): object {
    return {
      focusMode: this.focusMode,
      toolsCount: this.getToolsForFocusMode(this.focusMode).length,
      systemInstructions: !!this.systemInstructions,
      personaInstructions: !!this.personaInstructions,
    };
  }
}
