import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import { EventEmitter } from 'events';
import { SimplifiedAgent } from './simplifiedAgent';

/**
 * Agent Search class implementing LangGraph Supervisor pattern
 */
export class AgentSearch {
  private emitter: EventEmitter;
  private focusMode: string;

  // Simplified agent experimental implementation
  private simplifiedAgent: SimplifiedAgent;

  constructor(
    llm: BaseChatModel,
    embeddings: Embeddings,
    emitter: EventEmitter,
    systemInstructions: string = '',
    personaInstructions: string = '',
    signal: AbortSignal,
    focusMode: string = 'webSearch',
  ) {
    this.emitter = emitter;
    this.focusMode = focusMode;

    // Initialize simplified agent (experimental)
    this.simplifiedAgent = new SimplifiedAgent(
      llm,
      embeddings,
      emitter,
      systemInstructions,
      personaInstructions,
      signal,
    );
  }

  /**
   * Execute the simplified agent search workflow (experimental)
   */
  async searchAndAnswerSimplified(
    query: string,
    history: BaseMessage[] = [],
    fileIds: string[] = [],
  ): Promise<void> {
    console.log('AgentSearch: Using simplified agent implementation');

    // Delegate to simplified agent with focus mode
    await this.simplifiedAgent.searchAndAnswer(
      query,
      history,
      fileIds,
      this.focusMode,
    );
  }

  /**
   * Execute the agent search workflow
   */
  async searchAndAnswer(
    query: string,
    history: BaseMessage[] = [],
    fileIds: string[] = [],
  ) {
    console.log('AgentSearch: Routing to simplified agent implementation');
    return await this.searchAndAnswerSimplified(query, history, fileIds);
  }
}
