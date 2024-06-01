import fs from 'fs';
import path from 'path';
import { parse, stringify } from 'smol-toml';

const configFileName = 'config.toml';

interface Config {
  GENERAL: {
    PORT: number;
    SIMILARITY_MEASURE: string;
    ENABLE_COPILOT: boolean;
  };
  API_KEYS: {
    OPENAI: string;
    GROQ: string;
  };
  API_ENDPOINTS: {
    SEARXNG: string;
    OLLAMA: string;
  };
  MODELS: [
    {
      name: string;
      api_key: string;
      base_url: string;
      provider: string;
    },
  ];
  EMBEDDINGS: [
    {
      name: string;
      model: string;
      api_key: string;
      base_url: string;
      provider: string;
    },
  ];
}

type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

const loadConfig = () =>
  parse(
    fs.readFileSync(path.join(__dirname, `../${configFileName}`), 'utf-8'),
  ) as any as Config;

export const getPort = () => loadConfig().GENERAL.PORT;

export const getSimilarityMeasure = () =>
  loadConfig().GENERAL.SIMILARITY_MEASURE;

export const getOpenaiApiKey = () => loadConfig().API_KEYS.OPENAI;

export const getGroqApiKey = () => loadConfig().API_KEYS.GROQ;

export const getSearxngApiEndpoint = () => loadConfig().API_ENDPOINTS.SEARXNG;

export const getOllamaApiEndpoint = () => loadConfig().API_ENDPOINTS.OLLAMA;

export const getCustomModels = () => loadConfig().MODELS;

export const getCustomEmbeddingModels = () => loadConfig().EMBEDDINGS;

export const getCopilotEnabled = () => loadConfig().GENERAL.ENABLE_COPILOT;

export const updateConfig = (config: RecursivePartial<Config>) => {
  const currentConfig = loadConfig();

  const updatedConfig = {
    ...currentConfig,
    ...config,
  };

  const toml = stringify(updatedConfig);

  fs.writeFileSync(path.join(__dirname, `../${configFileName}`), toml);
};
