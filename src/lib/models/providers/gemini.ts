import { Model, ModelList } from '../types';
import {
  createOpenAICompatibleProvider,
  requireObject,
} from './openaiCompatible';

interface GeminiConfig {
  apiKey: string;
}

const GeminiProvider = createOpenAICompatibleProvider<GeminiConfig>({
  key: 'gemini',
  name: 'Gemini',
  supportsEmbeddings: true,
  configFields: [
    {
      type: 'password',
      name: 'API Key',
      key: 'apiKey',
      description: 'Your Gemini API key',
      required: true,
      placeholder: 'Gemini API Key',
      env: 'GEMINI_API_KEY',
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
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: config.apiKey,
  }),
  listDefaultModels: async (config): Promise<ModelList> => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const data = await res.json();

    const embedding: Model[] = [];
    const chat: Model[] = [];

    data.models.forEach((m: any) => {
      if (
        m.supportedGenerationMethods.some(
          (genMethod: string) =>
            genMethod === 'embedText' || genMethod === 'embedContent',
        )
      ) {
        embedding.push({ key: m.name, name: m.displayName });
      } else if (m.supportedGenerationMethods.includes('generateContent')) {
        chat.push({ key: m.name, name: m.displayName });
      }
    });

    return { embedding, chat };
  },
});

export default GeminiProvider;
