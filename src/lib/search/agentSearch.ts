import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import {
  BaseLangGraphError,
  END,
  MemorySaver,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { EventEmitter } from 'events';
import {
  AgentState,
  WebSearchAgent,
  AnalyzerAgent,
  SynthesizerAgent,
  TaskManagerAgent,
} from '../agents';

/**
 * Agent Search class implementing LangGraph Supervisor pattern
 */
export class AgentSearch {
  private llm: BaseChatModel;
  private embeddings: Embeddings;
  private checkpointer: MemorySaver;
  private signal: AbortSignal;
  private taskManagerAgent: TaskManagerAgent;
  private webSearchAgent: WebSearchAgent;
  private analyzerAgent: AnalyzerAgent;
  private synthesizerAgent: SynthesizerAgent;
  private emitter: EventEmitter;

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
    this.emitter = emitter;

    // Initialize agents
    this.taskManagerAgent = new TaskManagerAgent(
      llm,
      emitter,
      systemInstructions,
      signal,
    );
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
        'task_manager',
        this.taskManagerAgent.execute.bind(this.taskManagerAgent),
        {
          ends: ['web_search', 'analyzer'],
        },
      )
      .addNode(
        'web_search',
        this.webSearchAgent.execute.bind(this.webSearchAgent),
        {
          ends: ['task_manager'],
        },
      )
      .addNode(
        'analyzer',
        this.analyzerAgent.execute.bind(this.analyzerAgent),
        {
          ends: ['task_manager', 'synthesizer'],
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

    const initialState = {
      messages: [...history, new HumanMessage(query)],
      query,
    };

    try {
      await workflow.invoke(initialState, {
        configurable: { thread_id: `agent_search_${Date.now()}` },
        recursionLimit: 20,
        signal: this.signal,
      });
    } catch (error: BaseLangGraphError | any) {
      if (error instanceof BaseLangGraphError) {
        console.error('LangGraph error occurred:', error.message);
        if (error.lc_error_code === 'GRAPH_RECURSION_LIMIT') {
          this.emitter.emit(
            'data',
            JSON.stringify({
              type: 'response',
              data: "I've been working on this for a while and can't find a solution. Please try again with a different query.",
            }),
          );
          this.emitter.emit('end');
        }
      } else if (error.name === 'AbortError') {
        console.warn('Agent search was aborted:', error.message);
      } else {
        console.error('Unexpected error during agent search:', error);
      }
    }
  }
}
