import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import { EventEmitter } from 'events';
import { SimplifiedAgent } from './simplifiedAgent';
import DeepResearchAgent from './deepResearchAgent';

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
    llm: BaseChatModel,
    embeddings: Embeddings,
    emitter: EventEmitter,
    systemInstructions: string = '',
    personaInstructions: string = '',
    signal: AbortSignal,
    agentMode: string = 'webSearch',
    private chatId?: string,
  ) {
    this.emitter = emitter;
    this.agentMode = agentMode;

    // Initialize simplified agent (experimental)
    this.simplifiedAgent = new SimplifiedAgent(
      llm,
      embeddings,
      emitter,
      systemInstructions,
      personaInstructions,
      signal,
    );

    // Initialize deep research agent lazily only if needed
    if (agentMode === 'deepResearch') {
      this.deepResearchAgent = new DeepResearchAgent(
        llm,
        embeddings,
        emitter,
        systemInstructions,
        personaInstructions,
        signal,
        this.chatId || '',
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
