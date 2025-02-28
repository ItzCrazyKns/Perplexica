import fs from 'fs';
import path from 'path';
import toml from '@iarna/toml';

const configFileName = 'config.toml';

interface Config {
  GENERAL: {
    PORT: number;
    SIMILARITY_MEASURE: string;
    KEEP_ALIVE: string;
    SEARCH_ENGINE_BACKEND: string;
  };
  KEYCLOAK: {
    URL: string;
    REALM: string;
    CLIENT_ID: string;
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
  SEARCH_ENGINES: {
    GOOGLE: {
      API_KEY: string;
      CSE_ID: string;
    };
    SEARXNG: {
      ENDPOINT: string;
    };
    BING: {
      SUBSCRIPTION_KEY: string;
    };
    BRAVE: {
      API_KEY: string;
    };
    YACY: {
      ENDPOINT: string;
    };
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

export const getKeepAlive = () => loadConfig().GENERAL.KEEP_ALIVE;

export const getOpenaiApiKey = () => loadConfig().MODELS.OPENAI.API_KEY;

export const getGroqApiKey = () => loadConfig().MODELS.GROQ.API_KEY;

export const getAnthropicApiKey = () => loadConfig().MODELS.ANTHROPIC.API_KEY;

export const getGeminiApiKey = () => loadConfig().MODELS.GEMINI.API_KEY;

export const getSearchEngineBackend = () =>
  loadConfig().GENERAL.SEARCH_ENGINE_BACKEND;

export const getGoogleApiKey = () => loadConfig().SEARCH_ENGINES.GOOGLE.API_KEY;

export const getGoogleCseId = () => loadConfig().SEARCH_ENGINES.GOOGLE.CSE_ID;

export const getBraveApiKey = () => loadConfig().SEARCH_ENGINES.BRAVE.API_KEY;

export const getBingSubscriptionKey = () =>
  loadConfig().SEARCH_ENGINES.BING.SUBSCRIPTION_KEY;

export const getYacyJsonEndpoint = () => loadConfig().SEARCH_ENGINES.YACY.ENDPOINT;

export const getSearxngApiEndpoint = () =>
  process.env.SEARXNG_API_URL || loadConfig().SEARCH_ENGINES.SEARXNG.ENDPOINT;

export const getOllamaApiEndpoint = () => loadConfig().MODELS.OLLAMA.API_URL;

export const getCustomOpenaiApiKey = () =>
  loadConfig().MODELS.CUSTOM_OPENAI.API_KEY;

export const getCustomOpenaiApiUrl = () =>
  loadConfig().MODELS.CUSTOM_OPENAI.API_URL;

export const getCustomOpenaiModelName = () =>
  loadConfig().MODELS.CUSTOM_OPENAI.MODEL_NAME;

export const getKeyCloakUrl = () => loadConfig().KEYCLOAK.URL;

export const getKeyCloakRealm = () => loadConfig().KEYCLOAK.REALM;

export const getKeyCloakClientId = () => loadConfig().KEYCLOAK.CLIENT_ID;

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
    path.join(__dirname, `../${configFileName}`),
    toml.stringify(mergedConfig),
  );
};
