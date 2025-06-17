import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { EventEmitter } from 'events';
import {
  AgentState,
  WebSearchAgent,
  AnalyzerAgent,
  SynthesizerAgent,
} from '../agents';

/**
 * Agent Search class implementing LangGraph Supervisor pattern
 */
export class AgentSearch {
  private llm: BaseChatModel;
  private embeddings: Embeddings;
  private checkpointer: MemorySaver;
  private signal: AbortSignal;
  private webSearchAgent: WebSearchAgent;
  private analyzerAgent: AnalyzerAgent;
  private synthesizerAgent: SynthesizerAgent;

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
    this.checkpointer = new MemorySaver();
    this.signal = signal;

    // Initialize agents
    this.webSearchAgent = new WebSearchAgent(
      llm,
      emitter,
      systemInstructions,
      signal,
    );
    this.analyzerAgent = new AnalyzerAgent(
      llm,
      emitter,
      systemInstructions,
      signal,
    );
    this.synthesizerAgent = new SynthesizerAgent(
      llm,
      emitter,
      personaInstructions,
      signal,
    );
  }

  /**
   * Create and compile the agent workflow graph
   */
  private createWorkflow() {
    const workflow = new StateGraph(AgentState)
      .addNode(
        'web_search',
        this.webSearchAgent.execute.bind(this.webSearchAgent),
        {
          ends: ['analyzer'],
        },
      )
      .addNode(
        'analyzer',
        this.analyzerAgent.execute.bind(this.analyzerAgent),
        {
          ends: ['web_search', 'synthesizer'],
        },
      )
      .addNode(
        'synthesizer',
        this.synthesizerAgent.execute.bind(this.synthesizerAgent),
        {
          ends: [END],
        },
      )
      .addEdge(START, 'analyzer');

    return workflow.compile({ checkpointer: this.checkpointer });
  }

  /**
   * Execute the agent search workflow
   */
  async searchAndAnswer(query: string, history: BaseMessage[] = []) {
    const workflow = this.createWorkflow();

    try {
      const initialState = {
        messages: [...history, new HumanMessage(query)],
        query,
      };

      const result = await workflow.invoke(initialState, {
        configurable: { thread_id: `agent_search_${Date.now()}` },
        recursionLimit: 20,
        signal: this.signal,
      });

      return result;
    } catch (error) {
      console.error('Agent workflow error:', error);

      // Fallback to a simple response
      const fallbackResponse = await this.llm.invoke(
        [
          new SystemMessage(
            "You are a helpful assistant. The advanced agent workflow failed, so please provide a basic response to the user's query based on your knowledge.",
          ),
          new HumanMessage(query),
        ],
        { signal: this.signal },
      );

      return {
        messages: [...history, new HumanMessage(query), fallbackResponse],
        query,
        searchResults: [],
        next: END,
        analysis: '',
      };
    }
  }
}
