import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
import { Document } from 'langchain/document';

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
  relevantDocuments: Annotation<Document[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  /**
   * Original user query for context
   */
  query: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),

  /**
   * Focus mode for the agent
   */
  focusMode: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => 'webSearch',
  }),

  /**
   * File IDs available for search
   */
  fileIds: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
});

/**
 * Type definition for the simplified agent state
 */
export type SimplifiedAgentStateType = typeof SimplifiedAgentState.State;
