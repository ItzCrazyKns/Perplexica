import fs from 'fs';
import path from 'path';
import toml from '@iarna/toml';

const configFileName = 'config.toml';

interface Config {
  GENERAL: {
    SIMILARITY_MEASURE: string;
    KEEP_ALIVE: string;
  };
  MODELS: {
    OPENAI: {
      API_KEY: string;
    };
    GROQ: {
      API_KEY: string;
    };
    ANTHROPIC: {
      API_KEY: string;
    };
    GEMINI: {
      API_KEY: string;
    };
    OLLAMA: {
      API_URL: string;
    };
    CUSTOM_OPENAI: {
      API_URL: string;
      API_KEY: string;
      MODEL_NAME: string;
    };
  };
  API_ENDPOINTS: {
    SEARXNG: string;
  };
}

type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

const loadConfig = () => {
  const configPath = path.join(process.cwd(), configFileName);
  if (!fs.existsSync(configPath) || fs.lstatSync(configPath).isDirectory()) {
    return {} as Config;
  }
  return toml.parse(fs.readFileSync(configPath, 'utf-8')) as any as Config;
};

const getEnvVar = (key: string): string | undefined => {
  return process.env[key];
};

const getConfigValue = (path: string[], defaultValue: string): string => {
  // Convert path to environment variable name (e.g., ['MODELS', 'GROQ', 'API_KEY'] -> 'GROQ_API_KEY')
  const envKey = path.slice(1).join('_').toUpperCase();
  const envValue = getEnvVar(envKey);

  if (envValue !== undefined) {
    return envValue;
  }

  // Fall back to config.toml
  let value: any = loadConfig();
  for (const key of path) {
    value = value[key];
    if (value === undefined) {
      return defaultValue;
    }
  }
  return value;
};

export const getSimilarityMeasure = () =>
  getConfigValue(['GENERAL', 'SIMILARITY_MEASURE'], 'cosine');

export const getKeepAlive = () =>
  getConfigValue(['GENERAL', 'KEEP_ALIVE'], '30s');

export const getOpenaiApiKey = () =>
  getConfigValue(['MODELS', 'OPENAI', 'API_KEY'], '');

export const getGroqApiKey = () =>
  getConfigValue(['MODELS', 'GROQ', 'API_KEY'], '');

export const getAnthropicApiKey = () =>
  getConfigValue(['MODELS', 'ANTHROPIC', 'API_KEY'], '');

export const getGeminiApiKey = () =>
  getConfigValue(['MODELS', 'GEMINI', 'API_KEY'], '');

export const getSearxngApiEndpoint = () =>
  process.env.SEARXNG_API_URL || getConfigValue(['API_ENDPOINTS', 'SEARXNG'], '');

export const getOllamaApiEndpoint = () =>
  getConfigValue(['MODELS', 'OLLAMA', 'API_URL'], 'http://localhost:11434');

export const getCustomOpenaiApiKey = () =>
  getConfigValue(['MODELS', 'CUSTOM_OPENAI', 'API_KEY'], '');

export const getCustomOpenaiApiUrl = () =>
  getConfigValue(['MODELS', 'CUSTOM_OPENAI', 'API_URL'], '');

export const getCustomOpenaiModelName = () =>
  getConfigValue(['MODELS', 'CUSTOM_OPENAI', 'MODEL_NAME'], '');

const mergeConfigs = (current: any, update: any): any => {
  if (update === null || update === undefined) {
    return current;
  }

  if (typeof current !== 'object' || current === null) {
    return update;
  }

  const result = { ...current };

  for (const key in update) {
    if (Object.prototype.hasOwnProperty.call(update, key)) {
      const updateValue = update[key];

      if (
        typeof updateValue === 'object' &&
        updateValue !== null &&
        typeof result[key] === 'object' &&
        result[key] !== null
      ) {
        result[key] = mergeConfigs(result[key], updateValue);
      } else if (updateValue !== undefined) {
        result[key] = updateValue;
      }
    }
  }

  return result;
};

export const updateConfig = (config: RecursivePartial<Config>) => {
  const currentConfig = loadConfig();
  const mergedConfig = mergeConfigs(currentConfig, config);
  fs.writeFileSync(
    path.join(path.join(process.cwd(), `${configFileName}`)),
    toml.stringify(mergedConfig),
  );
};
