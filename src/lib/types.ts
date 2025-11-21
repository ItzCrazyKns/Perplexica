type ChatTurnMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type Chunk = {
  content: string;
  metadata: Record<string, any>;
};

type TextBlock = {
  id: string;
  type: 'text';
  data: string;
};

type SourceBlock = {
  id: string;
  type: 'source';
  data: Chunk[];
};

type SuggestionBlock = {
  id: string;
  type: 'suggestion';
  data: string[];
};

type WidgetBlock = {
  id: string;
  type: 'widget';
  data: {
    widgetType: string;
    params: Record<string, any>;
  };
};

type ReasoningResearchBlock = {
  id: string;
  reasoning: string;
};

type SearchingResearchBlock = {
  id: string;
  searching: string[];
};

type ReadingResearchBlock = {
  id: string;
  reading: Chunk[];
};

type ResearchBlockSubStep =
  | ReasoningResearchBlock
  | SearchingResearchBlock
  | ReadingResearchBlock;

type ResearchBlock = {
  id: string;
  type: 'research';
  data: {
    subSteps: ResearchBlockSubStep[];
  };
};

type Block =
  | TextBlock
  | SourceBlock
  | SuggestionBlock
  | WidgetBlock
  | ResearchBlock;
