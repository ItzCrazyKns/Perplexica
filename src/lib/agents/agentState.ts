import { BaseMessage } from '@langchain/core/messages';
import { Annotation, END } from '@langchain/langgraph';
import { Document } from 'langchain/document';

/**
 * State interface for the agent supervisor workflow
 */
export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  query: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  relevantDocuments: Annotation<Document[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  bannedSummaryUrls: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  bannedPreviewUrls: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  searchInstructionHistory: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  searchInstructions: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  next: Annotation<string>({
    reducer: (x, y) => y ?? x ?? END,
    default: () => END,
  }),
  analysis: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  fullAnalysisAttempts: Annotation<number>({
    reducer: (x, y) => (y ?? 0) + x,
    default: () => 0,
  }),
  tasks: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  currentTaskIndex: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  originalQuery: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
});
