import { Model, ModelList } from '../types';
import {
  createOpenAICompatibleProvider,
  requireObject,
} from './openaiCompatible';

interface LemonadeConfig {
  baseURL: string;
  apiKey?: string;
}

const LemonadeProvider = createOpenAICompatibleProvider<LemonadeConfig>({
  key: 'lemonade',
  name: 'Lemonade',
  supportsEmbeddings: true,
  configFields: [
    {
      type: 'string',
      name: 'Base URL',
      key: 'baseURL',
      description: 'The base URL for Lemonade API',
      required: true,
      placeholder: 'https://api.lemonade.ai/v1',
      env: 'LEMONADE_BASE_URL',
      scope: 'server',
    },
    {
      type: 'password',
      name: 'API Key',
      key: 'apiKey',
      description: 'Your Lemonade API key (optional)',
      required: false,
      placeholder: 'Lemonade API Key',
      env: 'LEMONADE_API_KEY',
      scope: 'server',
    },
  ],
  parseAndValidate: (raw) => {
    requireObject(raw);
    if (!raw.baseURL)
      throw new Error('Invalid config provided. Base URL must be provided');
    return {
      baseURL: String(raw.baseURL),
      apiKey: raw.apiKey ? String(raw.apiKey) : undefined,
    };
  },
  resolve: (config) => ({
    baseURL: config.baseURL,
    apiKey: config.apiKey || 'not-needed',
  }),
  listDefaultModels: async (config): Promise<ModelList> => {
    try {
      const res = await fetch(`${config.baseURL}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey
            ? { Authorization: `Bearer ${config.apiKey}` }
            : {}),
        },
      });

      const data = await res.json();

      const models: Model[] = data.data
        .filter((m: any) => m.recipe === 'llamacpp')
        .map((m: any) => ({ name: m.id, key: m.id }));

      return { embedding: models, chat: models };
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          'Error connecting to Lemonade API. Please ensure the base URL is correct and the service is available.',
        );
      }

      throw err;
    }
  },
});

export default LemonadeProvider;
