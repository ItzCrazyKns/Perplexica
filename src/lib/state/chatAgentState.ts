import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
import { Document } from 'langchain/document';

/**
 * Document interface for relevant documents collected by tools
 */
export interface RelevantDocument extends Document {
  /**
   * Source identifier (e.g., URL, file path, search query)
   */
  source: string;
  /**
   * Type of document source
   */
  sourceType: 'web' | 'file' | 'url' | 'analysis';
  /**
   * Relevance score for ranking
   */
  relevanceScore?: number;
  /**
   * Tool that generated this document
   */
  toolName?: string;
}

/**
 * State schema for the simplified chat agent using tool-based workflow
 * This state is designed for use with createReactAgent and focuses on
 * accumulating relevant documents across tool calls while maintaining
 * message history for the agent's decision-making process.
 */
export const SimplifiedAgentState = Annotation.Root({
  /**
   * Conversation messages - the primary communication channel
   * between the user, agent, and tools
   */
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  /**
   * Relevant documents accumulated across tool calls
   * This is the key state that tools will populate and the synthesizer will consume
   */
  relevantDocuments: Annotation<RelevantDocument[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  /**
   * Original user query for reference by tools
   */
  query: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),

  /**
   * Focus mode to maintain compatibility with existing agent behavior
   */
  focusMode: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => 'webSearch',
  }),
});

/**
 * Type definition for the simplified agent state
 */
export type SimplifiedAgentStateType = typeof SimplifiedAgentState.State;
