import { Model, ModelList } from '../types';
import {
  createOpenAICompatibleProvider,
  requireObject,
} from './openaiCompatible';

interface OpenAIConfig {
  apiKey: string;
  baseURL: string;
}

const defaultChatModels: Model[] = [
  {
    name: 'GPT-3.5 Turbo',
    key: 'gpt-3.5-turbo',
  },
  {
    name: 'GPT-4',
    key: 'gpt-4',
  },
  {
    name: 'GPT-4 turbo',
    key: 'gpt-4-turbo',
  },
  {
    name: 'GPT-4 omni',
    key: 'gpt-4o',
  },
  {
    name: 'GPT-4o (2024-05-13)',
    key: 'gpt-4o-2024-05-13',
  },
  {
    name: 'GPT-4 omni mini',
    key: 'gpt-4o-mini',
  },
  {
    name: 'GPT 4.1 nano',
    key: 'gpt-4.1-nano',
  },
  {
    name: 'GPT 4.1 mini',
    key: 'gpt-4.1-mini',
  },
  {
    name: 'GPT 4.1',
    key: 'gpt-4.1',
  },
  {
    name: 'GPT 5 nano',
    key: 'gpt-5-nano',
  },
  {
    name: 'GPT 5',
    key: 'gpt-5',
  },
  {
    name: 'GPT 5 Mini',
    key: 'gpt-5-mini',
  },
  {
    name: 'GPT 5 Pro',
    key: 'gpt-5-pro',
  },
  {
    name: 'GPT 5.1',
    key: 'gpt-5.1',
  },
  {
    name: 'GPT 5.2',
    key: 'gpt-5.2',
  },
  {
    name: 'GPT 5.2 Pro',
    key: 'gpt-5.2-pro',
  },
  {
    name: 'o1',
    key: 'o1',
  },
  {
    name: 'o3',
    key: 'o3',
  },
  {
    name: 'o3 Mini',
    key: 'o3-mini',
  },
  {
    name: 'o4 Mini',
    key: 'o4-mini',
  },
];

const defaultEmbeddingModels: Model[] = [
  {
    name: 'Text Embedding 3 Small',
    key: 'text-embedding-3-small',
  },
  {
    name: 'Text Embedding 3 Large',
    key: 'text-embedding-3-large',
  },
];

const OpenAIProvider = createOpenAICompatibleProvider<OpenAIConfig>({
  key: 'openai',
  name: 'OpenAI',
  supportsEmbeddings: true,
  configFields: [
    {
      type: 'password',
      name: 'API Key',
      key: 'apiKey',
      description: 'Your OpenAI API key',
      required: true,
      placeholder: 'OpenAI API Key',
      env: 'OPENAI_API_KEY',
      scope: 'server',
    },
    {
      type: 'string',
      name: 'Base URL',
      key: 'baseURL',
      description: 'The base URL for the OpenAI API',
      required: true,
      placeholder: 'OpenAI Base URL',
      default: 'https://api.openai.com/v1',
      env: 'OPENAI_BASE_URL',
      scope: 'server',
    },
  ],
  parseAndValidate: (raw) => {
    requireObject(raw);
    if (!raw.apiKey || !raw.baseURL)
      throw new Error(
        'Invalid config provided. API key and base URL must be provided',
      );
    return { apiKey: String(raw.apiKey), baseURL: String(raw.baseURL) };
  },
  resolve: (config) => ({ baseURL: config.baseURL, apiKey: config.apiKey }),
  /* Custom OpenAI-compatible endpoints get no static defaults; users
     register their models explicitly. */
  listDefaultModels: async (config): Promise<ModelList> =>
    config.baseURL === 'https://api.openai.com/v1'
      ? { embedding: defaultEmbeddingModels, chat: defaultChatModels }
      : { embedding: [], chat: [] },
});

export default OpenAIProvider;
