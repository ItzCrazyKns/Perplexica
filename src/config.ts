import fs from 'fs';
import path from 'path';
import toml from '@iarna/toml';

const configFileName = 'config.toml';

interface Config {
  GENERAL: {
    PORT: number;
    SIMILARITY_MEASURE: string;
  };
  API_KEYS: {
    OPENAI: string;
    GROQ: string;
    ANTHROPIC: string;
    AZURE: string;
  };
  API_ENDPOINTS: {
    SEARXNG: string;
    OLLAMA: string;
    AZURE: string;
  };
  AZURE_OPENAI: {
    DEPLOYMENT_NAME_GPT35_TURBO: string;
    DEPLOYMENT_NAME_GPT35_TURBO_16K: string;
    DEPLOYMENT_NAME_GPT35_TURBO_INSTRUCT: string;
    DEPLOYMENT_NAME_GPT4: string;
    DEPLOYMENT_NAME_GPT4_32K: string;
    DEPLOYMENT_NAME_GPT4_OMNI: string;
    DEPLOYMENT_NAME_GPT4_OMNI_MINI: string;
    DEPLOYMENT_NAME_EMBEDDINGS_ADA: string;
    DEPLOYMENT_NAME_EMBEDDINGS_SMALL: string;
    DEPLOYMENT_NAME_EMBEDDINGS_LARGE: string;
  };
}

type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

const loadConfig = () =>
  toml.parse(
    fs.readFileSync(path.join(__dirname, `../${configFileName}`), 'utf-8'),
  ) as any as Config;

export const getPort = () => loadConfig().GENERAL.PORT;

export const getSimilarityMeasure = () =>
  loadConfig().GENERAL.SIMILARITY_MEASURE;

export const getOpenaiApiKey = () => loadConfig().API_KEYS.OPENAI;

export const getGroqApiKey = () => loadConfig().API_KEYS.GROQ;

export const getAnthropicApiKey = () => loadConfig().API_KEYS.ANTHROPIC;

export const getSearxngApiEndpoint = () =>
  process.env.SEARXNG_API_URL || loadConfig().API_ENDPOINTS.SEARXNG;

export const getOllamaApiEndpoint = () => loadConfig().API_ENDPOINTS.OLLAMA;

export const getAzureOpenaiApiKey = () => loadConfig().API_KEYS.AZURE;

export const getAzureOpenaiEndpoint = () => loadConfig().API_ENDPOINTS.AZURE;

export const getAzureOpenaiDeploymentNameGpt35 = () =>
  loadConfig().AZURE_OPENAI.DEPLOYMENT_NAME_GPT35_TURBO;

export const getAzureOpenaiDeploymentNameGpt35_16K = () =>
  loadConfig().AZURE_OPENAI.DEPLOYMENT_NAME_GPT35_TURBO_16K;

export const getAzureOpenaiDeploymentNameGpt35TurboInstruct = () =>
  loadConfig().AZURE_OPENAI.DEPLOYMENT_NAME_GPT35_TURBO_INSTRUCT;

export const getAzureOpenaiDeploymentNameGpt4 = () =>
  loadConfig().AZURE_OPENAI.DEPLOYMENT_NAME_GPT4;

export const getAzureOpenaiDeploymentNameGpt4_32K = () =>
  loadConfig().AZURE_OPENAI.DEPLOYMENT_NAME_GPT4_32K;

export const getAzureOpenaiDeploymentNameGpt4o = () =>
  loadConfig().AZURE_OPENAI.DEPLOYMENT_NAME_GPT4_OMNI;

export const getAzureOpenaiDeploymentNameGpt4oMini = () =>
  loadConfig().AZURE_OPENAI.DEPLOYMENT_NAME_GPT4_OMNI_MINI;

export const getAzureOpenaiDeploymentNameEmbeddingsAda = () =>
  loadConfig().AZURE_OPENAI.DEPLOYMENT_NAME_EMBEDDINGS_ADA;

export const getAzureOpenaiDeploymentNameEmbeddingsSmall = () =>
  loadConfig().AZURE_OPENAI.DEPLOYMENT_NAME_EMBEDDINGS_SMALL;

export const getAzureOpenaiDeploymentNameEmbeddingsLarge = () =>
  loadConfig().AZURE_OPENAI.DEPLOYMENT_NAME_EMBEDDINGS_LARGE;

export const updateConfig = (config: RecursivePartial<Config>) => {
  const currentConfig = loadConfig();

  for (const key in currentConfig) {
    if (!config[key]) config[key] = {};

    if (typeof currentConfig[key] === 'object' && currentConfig[key] !== null) {
      for (const nestedKey in currentConfig[key]) {
        if (
          !config[key][nestedKey] &&
          currentConfig[key][nestedKey] &&
          config[key][nestedKey] !== ''
        ) {
          config[key][nestedKey] = currentConfig[key][nestedKey];
        }
      }
    } else if (currentConfig[key] && config[key] !== '') {
      config[key] = currentConfig[key];
    }
  }

  fs.writeFileSync(
    path.join(__dirname, `../${configFileName}`),
    toml.stringify(config),
  );
};
