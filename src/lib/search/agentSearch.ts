import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import { EventEmitter } from 'events';
import { SimplifiedAgent } from './simplifiedAgent';
import DeepResearchAgent from './deepResearchAgent';
import { CachedEmbeddings } from '../utils/cachedEmbeddings';

/**
 * Agent Search class implementing LangGraph Supervisor pattern
 */
export class AgentSearch {
  private emitter: EventEmitter;
  private agentMode: string;

  // Simplified agent experimental implementation
  private simplifiedAgent: SimplifiedAgent;
  private deepResearchAgent?: DeepResearchAgent;

  constructor(
    chatLlm: BaseChatModel,
    systemLlm: BaseChatModel,
    embeddings: CachedEmbeddings,
    emitter: EventEmitter,
    personaInstructions: string = '',
    signal: AbortSignal,
    agentMode: string = 'webSearch',
    private chatId?: string,
    private messageId?: string,
    private retrievalSignal?: AbortSignal,
  ) {
    this.emitter = emitter;
    this.agentMode = agentMode;

    // Initialize simplified agent (experimental)
    this.simplifiedAgent = new SimplifiedAgent(
      chatLlm,
      systemLlm,
      embeddings,
      emitter,
      personaInstructions,
      signal,
      this.messageId,
      this.retrievalSignal,
    );

    // Initialize deep research agent lazily only if needed
    if (agentMode === 'deepResearch') {
      this.deepResearchAgent = new DeepResearchAgent(
        chatLlm,
        systemLlm,
        embeddings,
        emitter,
        personaInstructions,
        signal,
        this.chatId || '',
        this.messageId || '',
        this.retrievalSignal || signal,
      );
    }
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

    // Delegate to simplified agent with agentMode
    await this.simplifiedAgent.searchAndAnswer(
      query,
      history,
      fileIds,
      this.agentMode,
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
    if (this.agentMode === 'deepResearch' && this.deepResearchAgent) {
      console.log('AgentSearch: Routing to DeepResearchAgent');
      return await this.deepResearchAgent.searchAndAnswer(
        query,
        history,
        fileIds,
      );
    }

    console.log('AgentSearch: Routing to simplified agent implementation');
    return await this.searchAndAnswerSimplified(query, history, fileIds);
  }
}
