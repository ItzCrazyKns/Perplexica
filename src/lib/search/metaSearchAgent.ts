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
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'agent',
    fileIds: string[],
    systemInstructions: string,
    signal: AbortSignal,
    personaInstructions?: string,
    focusMode?: string,
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
    llm: BaseChatModel,
    embeddings: Embeddings,
    emitter: eventEmitter,
    message: string,
    history: BaseMessage[],
    fileIds: string[],
    systemInstructions: string,
    personaInstructions: string,
    signal: AbortSignal,
    focusMode: string,
  ) {
    try {
      const agentSearch = new AgentSearch(
        llm,
        embeddings,
        emitter,
        systemInstructions,
        personaInstructions,
        signal,
        focusMode,
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
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'agent',
    fileIds: string[],
    systemInstructions: string,
    signal: AbortSignal,
    personaInstructions?: string,
    focusMode?: string,
  ) {
    const emitter = new eventEmitter();

    // Branch to speed search if optimization mode is 'speed'
    if (optimizationMode === 'speed') {
      const speedSearchAgent = new SpeedSearchAgent(this.config);
      return speedSearchAgent.searchAndAnswer(
        message,
        history,
        llm,
        embeddings,
        systemInstructions,
        signal,
        personaInstructions,
        focusMode,
      );
    }

    // Execute agent workflow for 'agent' mode
    this.executeAgentWorkflow(
      llm,
      embeddings,
      emitter,
      message,
      history,
      fileIds,
      systemInstructions,
      personaInstructions || '',
      signal,
      focusMode || 'webSearch',
    );

    return emitter;
  }
}

export default MetaSearchAgent;
