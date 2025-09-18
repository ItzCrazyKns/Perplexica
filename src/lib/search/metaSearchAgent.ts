import type { Embeddings } from '@langchain/core/embeddings';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import eventEmitter from 'events';
import { AgentSearch } from './agentSearch';
import SpeedSearchAgent from './speedSearch';

export interface MetaSearchAgentType {
  searchAndAnswer: (
    message: string,
    history: BaseMessage[],
    chatId: string,
    chatLlm: BaseChatModel,
    systemLlm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'agent' | 'deepResearch',
    fileIds: string[],
    signal: AbortSignal,
    personaInstructions?: string,
    focusMode?: string,
    messageId?: string,
    retrievalSignal?: AbortSignal,
  ) => Promise<eventEmitter>;
}

interface Config {
  searchWeb: boolean;
  rerank: boolean;
  summarizer: boolean;
  rerankThreshold: number;
  queryGeneratorPrompt: string;
  responsePrompt: string;
  activeEngines: string[];
  additionalSearchCriteria?: string;
}

class MetaSearchAgent implements MetaSearchAgentType {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Execute agent workflow asynchronously with proper streaming support
   */
  private async executeAgentWorkflow(
    chatLlm: BaseChatModel,
    systemLlm: BaseChatModel,
    embeddings: Embeddings,
    emitter: eventEmitter,
    message: string,
    history: BaseMessage[],
    chatId: string,
    fileIds: string[],
    personaInstructions: string,
    signal: AbortSignal,
    focusMode: string,
    messageId?: string,
    retrievalSignal?: AbortSignal,
  ) {
    try {
      const agentSearch = new AgentSearch(
        chatLlm,
        systemLlm,
        embeddings,
        emitter,
        personaInstructions,
        signal,
        focusMode,
        chatId,
        messageId,
        retrievalSignal,
      );

      // Execute the agent workflow
      await agentSearch.searchAndAnswer(message, history, fileIds);

      // No need to emit end signals here since synthesizerAgent
      // is now streaming in real-time and emits them
    } catch (error) {
      console.error('Agent search error:', error);
      emitter.emit(
        'error',
        JSON.stringify({
          data: `Agent search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }),
      );
      emitter.emit('end');
    }
  }

  async searchAndAnswer(
    message: string,
    history: BaseMessage[],
    chatId: string,
    chatLlm: BaseChatModel,
    systemLlm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'agent' | 'deepResearch',
    fileIds: string[],
    signal: AbortSignal,
    personaInstructions?: string,
    focusMode?: string,
    messageId?: string,
    retrievalSignal?: AbortSignal,
  ) {
    const emitter = new eventEmitter();

    // Branch to speed search if optimization mode is 'speed'
    if (optimizationMode === 'speed') {
      const speedSearchAgent = new SpeedSearchAgent(this.config);
      return speedSearchAgent.searchAndAnswer(
        message,
        history,
        chatLlm,
        systemLlm,
        embeddings,
        signal,
        personaInstructions,
        focusMode,
      );
    }

    // Execute deep research workflow when selected
    if (optimizationMode === 'deepResearch') {
      this.executeAgentWorkflow(
        chatLlm,
        systemLlm,
        embeddings,
        emitter,
        message,
        history,
        chatId,
        fileIds,
        personaInstructions || '',
        signal,
        'deepResearch',
        messageId || '',
        retrievalSignal || signal,
      );

      return emitter;
    }

    // Execute agent workflow for 'agent' mode (default)
    this.executeAgentWorkflow(
      chatLlm,
      systemLlm,
      embeddings,
      emitter,
      message,
      history,
      chatId,
      fileIds,
      personaInstructions || '',
      signal,
      focusMode || 'webSearch',
      messageId || '',
      retrievalSignal || signal,
    );

    return emitter;
  }
}

export default MetaSearchAgent;
