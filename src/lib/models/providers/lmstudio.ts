import { Model, ModelList } from '../types';
import {
  createOpenAICompatibleProvider,
  requireObject,
} from './openaiCompatible';

interface LMStudioConfig {
  baseURL: string;
}

const normalizeBaseURL = (url: string): string => {
  const trimmed = url.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
};

const LMStudioProvider = createOpenAICompatibleProvider<LMStudioConfig>({
  key: 'lmstudio',
  name: 'LM Studio',
  supportsEmbeddings: true,
  configFields: [
    {
      type: 'string',
      name: 'Base URL',
      key: 'baseURL',
      description: 'The base URL for LM Studio server',
      required: true,
      placeholder: 'http://localhost:1234',
      env: 'LM_STUDIO_BASE_URL',
      scope: 'server',
    },
  ],
  parseAndValidate: (raw) => {
    requireObject(raw);
    if (!raw.baseURL)
      throw new Error('Invalid config provided. Base URL must be provided');
    return { baseURL: String(raw.baseURL) };
  },
  resolve: (config) => ({
    baseURL: normalizeBaseURL(config.baseURL),
    apiKey: 'lm-studio',
  }),
  listDefaultModels: async (_config, { baseURL }): Promise<ModelList> => {
    try {
      const res = await fetch(`${baseURL}/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      const models: Model[] = data.data.map((m: any) => ({
        name: m.id,
        key: m.id,
      }));

      return { embedding: models, chat: models };
    } catch (err) {
      if (err instanceof TypeError) {
        throw new Error(
          'Error connecting to LM Studio. Please ensure the base URL is correct and the LM Studio server is running.',
        );
      }

      throw err;
    }
  },
});

export default LMStudioProvider;
