import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import prompts from '../prompts';
import { MetaSearchAgent } from './metaSearchAgent';
import { Embeddings } from '@langchain/core/embeddings';

export type HandlerNames =
  | 'webSearch'
  | 'academicSearch'
  | 'writingAssistant'
  | 'wolframAlphaSearch'
  | 'youtubeSearch'
  | 'redditSearch';

type HandlerConfig = {
  activeEngines: string[];
  queryGeneratorPrompt: string;
  responsePrompt: string;
  queryGeneratorFewShots: any[];
  rerank: boolean;
  rerankThreshold: number;
  searchWeb: boolean;
};

const getHandlerConfig = (handlerName: HandlerNames): HandlerConfig => {
  const configs: Record<HandlerNames, HandlerConfig> = {
    webSearch: {
      activeEngines: [],
      queryGeneratorPrompt: prompts.webSearchRetrieverPrompt,
      responsePrompt: prompts.webSearchResponsePrompt,
      queryGeneratorFewShots: prompts.webSearchRetrieverFewShots,
      rerank: true,
      rerankThreshold: 0.3,
      searchWeb: true,
    },
    academicSearch: {
      activeEngines: ['arxiv', 'google scholar', 'pubmed'],
      queryGeneratorPrompt: prompts.webSearchRetrieverPrompt,
      responsePrompt: prompts.webSearchResponsePrompt,
      queryGeneratorFewShots: prompts.webSearchRetrieverFewShots,
      rerank: true,
      rerankThreshold: 0,
      searchWeb: true,
    },
    writingAssistant: {
      activeEngines: [],
      queryGeneratorPrompt: '',
      queryGeneratorFewShots: [],
      responsePrompt: prompts.writingAssistantPrompt,
      rerank: true,
      rerankThreshold: 0,
      searchWeb: false,
    },
    wolframAlphaSearch: {
      activeEngines: ['wolframalpha'],
      queryGeneratorPrompt: prompts.webSearchRetrieverPrompt,
      responsePrompt: prompts.webSearchResponsePrompt,
      queryGeneratorFewShots: prompts.webSearchRetrieverFewShots,
      rerank: false,
      rerankThreshold: 0,
      searchWeb: true,
    },
    youtubeSearch: {
      activeEngines: ['youtube'],
      queryGeneratorPrompt: prompts.webSearchRetrieverPrompt,
      responsePrompt: prompts.webSearchResponsePrompt,
      queryGeneratorFewShots: prompts.webSearchRetrieverFewShots,
      rerank: true,
      rerankThreshold: 0.3,
      searchWeb: true,
    },
    redditSearch: {
      activeEngines: ['reddit'],
      queryGeneratorPrompt: prompts.webSearchRetrieverPrompt,
      responsePrompt: prompts.webSearchResponsePrompt,
      queryGeneratorFewShots: prompts.webSearchRetrieverFewShots,
      rerank: true,
      rerankThreshold: 0.3,
      searchWeb: true,
    },
  };

  return configs[handlerName];
};

export const getSearchHandler = (
  handlerName: HandlerNames,
  llm: BaseChatModel,
  embeddings: Embeddings,
): MetaSearchAgent => {
  const config = getHandlerConfig(handlerName);
  return new MetaSearchAgent(config, llm, embeddings);
};
