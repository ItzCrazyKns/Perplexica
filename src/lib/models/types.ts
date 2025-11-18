import z from 'zod';

type Model = {
  name: string;
  key: string;
};

type ModelList = {
  embedding: Model[];
  chat: Model[];
};

type ProviderMetadata = {
  name: string;
  key: string;
};

type MinimalProvider = {
  id: string;
  name: string;
  chatModels: Model[];
  embeddingModels: Model[];
};

type ModelWithProvider = {
  key: string;
  providerId: string;
};

type GenerateOptions = {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  frequencyPenalty?: number;
  presencePenalty?: number;
};

type GenerateTextInput = {
  messages: Message[];
  options?: GenerateOptions;
};

type GenerateTextOutput = {
  content: string;
  additionalInfo?: Record<string, any>;
};

type StreamTextOutput = {
  contentChunk: string;
  additionalInfo?: Record<string, any>;
  done?: boolean;
};

type GenerateObjectInput = {
  schema: z.ZodTypeAny;
  messages: Message[];
  options?: GenerateOptions;
};

type GenerateObjectOutput<T> = {
  object: T;
  additionalInfo?: Record<string, any>;
};

type StreamObjectOutput<T> = {
  objectChunk: Partial<T>;
  additionalInfo?: Record<string, any>;
  done?: boolean;
};

export type {
  Model,
  ModelList,
  ProviderMetadata,
  MinimalProvider,
  ModelWithProvider,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
  GenerateObjectInput,
  GenerateObjectOutput,
  StreamObjectOutput,
};
