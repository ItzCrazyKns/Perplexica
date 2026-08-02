import { Model, ModelList } from '../types';
import {
  createOpenAICompatibleProvider,
  requireObject,
} from './openaiCompatible';

interface AnthropicConfig {
  apiKey: string;
}

const AnthropicProvider = createOpenAICompatibleProvider<AnthropicConfig>({
  key: 'anthropic',
  name: 'Anthropic',
  supportsEmbeddings: false,
  configFields: [
    {
      type: 'password',
      name: 'API Key',
      key: 'apiKey',
      description: 'Your Anthropic API key',
      required: true,
      placeholder: 'Anthropic API Key',
      env: 'ANTHROPIC_API_KEY',
      scope: 'server',
    },
  ],
  parseAndValidate: (raw) => {
    requireObject(raw);
    if (!raw.apiKey)
      throw new Error('Invalid config provided. API key must be provided');
    return { apiKey: String(raw.apiKey) };
  },
  resolve: (config) => ({
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: config.apiKey,
  }),
  listDefaultModels: async (config): Promise<ModelList> => {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=999', {
      method: 'GET',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Anthropic models: ${res.statusText}`);
    }

    const data = (await res.json()).data;

    const models: Model[] = data.map((m: any) => ({
      key: m.id,
      name: m.display_name,
    }));

    return { embedding: [], chat: models };
  },
});

export default AnthropicProvider;
