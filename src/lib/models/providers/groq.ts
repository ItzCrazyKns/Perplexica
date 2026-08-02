import { Model, ModelList } from '../types';
import {
  createOpenAICompatibleProvider,
  requireObject,
} from './openaiCompatible';

interface GroqConfig {
  apiKey: string;
}

const GroqProvider = createOpenAICompatibleProvider<GroqConfig>({
  key: 'groq',
  name: 'Groq',
  supportsEmbeddings: false,
  configFields: [
    {
      type: 'password',
      name: 'API Key',
      key: 'apiKey',
      description: 'Your Groq API key',
      required: true,
      placeholder: 'Groq API Key',
      env: 'GROQ_API_KEY',
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
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: config.apiKey,
  }),
  listDefaultModels: async (_config, { baseURL, apiKey }): Promise<ModelList> => {
    const res = await fetch(`${baseURL}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await res.json();

    const chat: Model[] = data.data.map((m: any) => ({
      key: m.id,
      name: m.id,
    }));

    return { embedding: [], chat };
  },
});

export default GroqProvider;
