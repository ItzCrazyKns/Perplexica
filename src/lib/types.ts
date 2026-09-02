import { ToolCall } from './models/types';

export type SystemMessage = {
  role: 'system';
  content: string;
};

export type AssistantMessage = {
  role: 'assistant';
  content: string;
  tool_calls?: ToolCall[];
};

export type UserMessage = {
  role: 'user';
  content: string;
};

export type ToolMessage = {
  role: 'tool';
  id: string;
  name: string;
  content: string;
};

export type ChatTurnMessage = UserMessage | AssistantMessage;

export type Message =
  | UserMessage
  | AssistantMessage
  | SystemMessage
  | ToolMessage;

export type Chunk = {
  content: string;
  metadata: Record<string, any>;
};

export type TextBlock = {
  id: string;
  type: 'text';
  data: string;
};

export type SourceBlock = {
  id: string;
  type: 'source';
  data: Chunk[];
};

export type SuggestionBlock = {
  id: string;
  type: 'suggestion';
  data: string[];
};

export type WidgetBlock = {
  id: string;
  type: 'widget';
  data: {
    widgetType: string;
    params: Record<string, any>;
  };
};

export type ReasoningResearchBlock = {
  id: string;
  type: 'reasoning';
  reasoning: string;
};

export type SearchingResearchBlock = {
  id: string;
  type: 'searching';
  searching: string[];
};

export type SearchResultsResearchBlock = {
  id: string;
  type: 'search_results';
  reading: Chunk[];
};

export type ReadingResearchBlock = {
  id: string;
  type: 'reading';
  reading: Chunk[];
};

export type UploadSearchingResearchBlock = {
  id: string;
  type: 'upload_searching';
  queries: string[];
};

export type UploadSearchResultsResearchBlock = {
  id: string;
  type: 'upload_search_results';
  results: Chunk[];
};

export type NotionSearchingResearchBlock = {
  id: string;
  type: 'notion_searching';
  queries: string[];
};

export type NotionSearchResultsResearchBlock = {
  id: string;
  type: 'notion_search_results';
  results: Chunk[];
};

export type ResearchBlockSubStep =
  | ReasoningResearchBlock
  | SearchingResearchBlock
  | SearchResultsResearchBlock
  | ReadingResearchBlock
  | UploadSearchingResearchBlock
  | UploadSearchResultsResearchBlock
  | NotionSearchingResearchBlock
  | NotionSearchResultsResearchBlock;

export type ResearchBlock = {
  id: string;
  type: 'research';
  data: {
    subSteps: ResearchBlockSubStep[];
  };
};

/** One pending/executed write shown inside a WriteConfirmationBlock. */
export type WriteConfirmationItem = {
  id: string;
  kind: 'append' | 'update' | 'create';
  /** For append/update: the target page. For create: the parent. */
  target: { id: string | null; title: string };
  /** Set for update (new title) and create (page title). */
  title?: string;
  contentPreview: string;
  /** Same-named page already exists — the card offers a three-way choice. */
  collision?: { existingId: string; existingTitle: string };
  result?: { ok: boolean; message: string; url?: string };
};

export type WriteConfirmationBlock = {
  id: string;
  type: 'writeConfirmation';
  data: {
    /** Session that owns the pending decision (for the confirm API). */
    sessionId: string;
    status: 'pending' | 'approved' | 'rejected';
    writes: WriteConfirmationItem[];
  };
};

export type Block =
  | TextBlock
  | SourceBlock
  | SuggestionBlock
  | WidgetBlock
  | ResearchBlock
  | WriteConfirmationBlock;
