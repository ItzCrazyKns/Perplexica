import z from 'zod';
import BaseLLM from '../../models/base/llm';
import BaseEmbedding from '@/lib/models/base/embedding';
import SessionManager from '@/lib/session';
import { ChatTurnMessage, Chunk } from '@/lib/types';

export type SearchSources = 'web' | 'discussions' | 'academic';

export type SearchAgentConfig = {
  sources: SearchSources[];
  llm: BaseLLM<any>;
  embedding: BaseEmbedding<any>;
  mode: 'speed' | 'balanced' | 'quality';
};

export type SearchAgentInput = {
  chatHistory: ChatTurnMessage[];
  followUp: string;
  config: SearchAgentConfig;
};

export interface Intent {
  name: string;
  description: string;
  requiresSearch: boolean;
  enabled: (config: { sources: SearchSources[] }) => boolean;
}

export type Widget<TSchema extends z.ZodObject<any> = z.ZodObject<any>> = {
  name: string;
  description: string;
  schema: TSchema;
  execute: (
    params: z.infer<TSchema>,
    additionalConfig: AdditionalConfig,
  ) => Promise<WidgetOutput>;
};

export type WidgetConfig = {
  type: string;
  params: Record<string, any>;
};

export type WidgetOutput = {
  type: string;
  llmContext: string;
  data: any;
};

export type ClassifierInput = {
  llm: BaseLLM<any>;
  enabledSources: SearchSources[];
  query: string;
  chatHistory: ChatTurnMessage[];
};

export type ClassifierOutput = {
  classification: {
    skipSearch: boolean;
    personalSearch: boolean;
    academicSearch: boolean;
    discussionSearch: boolean;
    showWeatherWidget: boolean;
    showStockWidget: boolean;
    showCalculationWidget: boolean;
  };
  standaloneFollowUp: string;
};

export type AdditionalConfig = {
  llm: BaseLLM<any>;
  embedding: BaseEmbedding<any>;
  session: SessionManager;
};

export type ResearcherInput = {
  chatHistory: ChatTurnMessage[];
  followUp: string;
  classification: ClassifierOutput;
  config: SearchAgentConfig;
};

export type ResearcherOutput = {
  findings: ActionOutput[];
};

export type SearchActionOutput = {
  type: 'search_results';
  results: Chunk[];
};

export type DoneActionOutput = {
  type: 'done';
};

export type ActionOutput = SearchActionOutput | DoneActionOutput;

export interface ResearchAction<
  TSchema extends z.ZodObject<any> = z.ZodObject<any>,
> {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
  enabled: (config: { classification: ClassifierOutput }) => boolean;
  execute: (
    params: z.infer<TSchema>,
    additionalConfig: AdditionalConfig,
  ) => Promise<ActionOutput>;
}

export type ActionConfig = {
  type: string;
  params: Record<string, any>;
};
