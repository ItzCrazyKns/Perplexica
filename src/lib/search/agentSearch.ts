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
  GraphRecursionError,
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
  FileSearchAgent,
  ContentRouterAgent,
  URLSummarizationAgent,
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
  private fileSearchAgent: FileSearchAgent;
  private contentRouterAgent: ContentRouterAgent;
  private urlSummarizationAgent: URLSummarizationAgent;
  private emitter: EventEmitter;
  private focusMode: string;

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
    this.checkpointer = new MemorySaver();
    this.signal = signal;
    this.emitter = emitter;
    this.focusMode = focusMode;

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
      embeddings,
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
    this.fileSearchAgent = new FileSearchAgent(
      llm,
      emitter,
      systemInstructions,
      signal,
      embeddings,
    );
    this.contentRouterAgent = new ContentRouterAgent(
      llm,
      emitter,
      systemInstructions,
      signal,
    );
    this.urlSummarizationAgent = new URLSummarizationAgent(
      llm,
      emitter,
      systemInstructions,
      signal,
    );
  }

  /**
   * Create and compile the agent workflow graph
   */
  private createWorkflow() {
    const workflow = new StateGraph(AgentState)
      .addNode(
        'url_summarization',
        this.urlSummarizationAgent.execute.bind(this.urlSummarizationAgent),
        {
          ends: ['task_manager', 'analyzer'],
        },
      )
      .addNode(
        'task_manager',
        this.taskManagerAgent.execute.bind(this.taskManagerAgent),
        {
          ends: ['content_router', 'analyzer'],
        },
      )
      .addNode(
        'content_router',
        this.contentRouterAgent.execute.bind(this.contentRouterAgent),
        {
          ends: ['file_search', 'web_search', 'analyzer'],
        },
      )
      .addNode(
        'file_search',
        this.fileSearchAgent.execute.bind(this.fileSearchAgent),
        {
          ends: ['analyzer'],
        },
      )
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
          ends: ['url_summarization', 'task_manager', 'synthesizer'],
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
  async searchAndAnswer(
    query: string,
    history: BaseMessage[] = [],
    fileIds: string[] = [],
  ) {
    const workflow = this.createWorkflow();

    const initialState = {
      messages: [...history, new HumanMessage(query)],
      query,
      fileIds,
      focusMode: this.focusMode,
    };

    const threadId = `agent_search_${Date.now()}`;
    const config = {
      configurable: { thread_id: threadId },
      recursionLimit: 18,
      signal: this.signal,
    };

    try {
      const result = await workflow.invoke(initialState, config);
    } catch (error: any) {
      if (error instanceof GraphRecursionError) {
        console.warn(
          'Graph recursion limit reached, attempting best-effort synthesis with gathered information',
        );

        // Emit agent action to explain what happened
        this.emitter.emit(
          'data',
          JSON.stringify({
            type: 'agent_action',
            data: {
              action: 'recursion_limit_recovery',
              message:
                'Search process reached complexity limits. Attempting to provide best-effort response with gathered information.',
              details:
                'The agent workflow exceeded the maximum number of steps allowed. Recovering by synthesizing available data.',
            },
          }),
        );

        try {
          // Get the latest state from the checkpointer to access gathered information
          const latestState = await workflow.getState({
            configurable: { thread_id: threadId },
          });

          if (latestState && latestState.values) {
            // Create emergency synthesis state using gathered information
            const stateValues = latestState.values;
            const emergencyState = {
              messages: stateValues.messages || initialState.messages,
              query: stateValues.query || initialState.query,
              relevantDocuments: stateValues.relevantDocuments || [],
              bannedSummaryUrls: stateValues.bannedSummaryUrls || [],
              bannedPreviewUrls: stateValues.bannedPreviewUrls || [],
              searchInstructionHistory:
                stateValues.searchInstructionHistory || [],
              searchInstructions: stateValues.searchInstructions || '',
              next: 'synthesizer',
              analysis: stateValues.analysis || '',
              fullAnalysisAttempts: stateValues.fullAnalysisAttempts || 0,
              tasks: stateValues.tasks || [],
              currentTaskIndex: stateValues.currentTaskIndex || 0,
              originalQuery:
                stateValues.originalQuery ||
                stateValues.query ||
                initialState.query,
              fileIds: stateValues.fileIds || initialState.fileIds,
              focusMode: stateValues.focusMode || initialState.focusMode,
              urlsToSummarize: stateValues.urlsToSummarize || [],
              summarizationIntent: stateValues.summarizationIntent || '',
              recursionLimitReached: true,
            };

            const documentsCount =
              emergencyState.relevantDocuments?.length || 0;
            console.log(
              `Attempting emergency synthesis with ${documentsCount} gathered documents`,
            );

            // Emit detailed agent action about the recovery attempt
            this.emitter.emit(
              'data',
              JSON.stringify({
                type: 'agent_action',
                data: {
                  action: 'emergency_synthesis',
                  message: `Proceeding with available information: ${documentsCount} documents gathered${emergencyState.analysis ? ', analysis available' : ''}`,
                  details: `Recovered state contains: ${documentsCount} relevant documents, ${emergencyState.searchInstructionHistory?.length || 0} search attempts, ${emergencyState.analysis ? 'analysis data' : 'no analysis'}`,
                },
              }),
            );

            // Only proceed with synthesis if we have some useful information
            if (documentsCount > 0 || emergencyState.analysis) {
              await this.synthesizerAgent.execute(emergencyState);
            } else {
              // If we don't have any gathered information, provide a helpful message
              this.emitter.emit(
                'data',
                JSON.stringify({
                  type: 'response',
                  data: "⚠️ **Search Process Incomplete** - The search process reached complexity limits before gathering sufficient information to provide a meaningful response. Please try:\n\n- Using more specific keywords\n- Breaking your question into smaller parts\n- Rephrasing your query to be more focused\n\nI apologize that I couldn't provide the information you were looking for.",
                }),
              );
              this.emitter.emit('end');
            }
          } else {
            // Fallback if we can't retrieve state
            this.emitter.emit(
              'data',
              JSON.stringify({
                type: 'response',
                data: '⚠️ **Limited Information Available** - The search process encountered complexity limits and was unable to gather sufficient information. Please try rephrasing your question or breaking it into smaller, more specific parts.',
              }),
            );
            this.emitter.emit('end');
          }
        } catch (synthError) {
          console.error('Emergency synthesis failed:', synthError);
          this.emitter.emit(
            'data',
            JSON.stringify({
              type: 'response',
              data: '⚠️ **Search Process Interrupted** - The search encountered complexity limits and could not complete successfully. Please try a simpler query or break your question into smaller parts.',
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
