import { EventEmitter } from 'stream';
import z from 'zod';
import BaseLLM from '../../models/base/llm';
import BaseEmbedding from '@/lib/models/base/embedding';

export type SearchSources = 'web' | 'discussions' | 'academic';

export type SearchAgentConfig = {
  sources: SearchSources[];
  llm: BaseLLM<any>;
  embedding: BaseEmbedding<any>;
};

export type SearchAgentInput = {
  chatHistory: Message[];
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
  data: any;
};

export type ClassifierInput = {
  llm: BaseLLM<any>;
  enabledSources: SearchSources[];
  query: string;
  chatHistory: Message[];
};

export type ClassifierOutput = {
  skipSearch: boolean;
  standaloneFollowUp: string;
  intents: string[];
  widgets: WidgetConfig[];
};

export type AdditionalConfig = {
  llm: BaseLLM<any>;
  embedding: BaseLLM<any>;
  emitter: EventEmitter;
};
