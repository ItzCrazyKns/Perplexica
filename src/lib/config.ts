import toml from '@iarna/toml';

// Use dynamic imports for Node.js modules to prevent client-side errors
let fs: any;
let path: any;
if (typeof window === 'undefined') {
  // We're on the server
  fs = require('fs');
  path = require('path');
}

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
      API_KEY: string;
    };
    DEEPSEEK: {
      API_KEY: string;
    };
    AIMLAPI: {
      API_KEY: string;
    };
    LM_STUDIO: {
      API_URL: string;
    };
    LEMONADE: {
      API_URL: string;
      API_KEY: string;
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
  MEMORY: {
    ENABLED: boolean;
    PROVIDER: string;
    CLOUD: {
      API_KEY: string;
      ORGANIZATION_NAME: string;
      PROJECT_NAME: string;
      ORGANIZATION_ID: string;
      PROJECT_ID: string;
    };
    SELF_HOSTED: {
      EMBEDDER_PROVIDER: string;
      EMBEDDER_MODEL: string;
      EMBEDDER_API_KEY: string;
      VECTOR_STORE_PROVIDER: string;
      VECTOR_STORE_URL: string;
      VECTOR_STORE_API_KEY: string;
      LLM_PROVIDER: string;
      LLM_MODEL: string;
      LLM_API_KEY: string;
    };
    STORAGE: {
      RETENTION_DAYS: number;
      MAX_MEMORIES_PER_USER: number;
      AUTO_CLEANUP: boolean;
    };
  };
}

type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

const loadConfig = () => {
  // Server-side only
  if (typeof window === 'undefined') {
    return toml.parse(
      fs.readFileSync(path.join(process.cwd(), `${configFileName}`), 'utf-8'),
    ) as any as Config;
  }

  // Client-side fallback - settings will be loaded via API
  return {} as Config;
};

export const getSimilarityMeasure = () =>
  loadConfig().GENERAL.SIMILARITY_MEASURE;

export const getKeepAlive = () => loadConfig().GENERAL.KEEP_ALIVE;

export const getOpenaiApiKey = () => loadConfig().MODELS.OPENAI.API_KEY;

export const getGroqApiKey = () => loadConfig().MODELS.GROQ.API_KEY;

export const getAnthropicApiKey = () => loadConfig().MODELS.ANTHROPIC.API_KEY;

export const getGeminiApiKey = () => loadConfig().MODELS.GEMINI.API_KEY;

export const getSearxngApiEndpoint = () =>
  process.env.SEARXNG_API_URL || loadConfig().API_ENDPOINTS.SEARXNG;

export const getOllamaApiEndpoint = () => loadConfig().MODELS.OLLAMA.API_URL;

export const getOllamaApiKey = () => loadConfig().MODELS.OLLAMA.API_KEY;

export const getDeepseekApiKey = () => loadConfig().MODELS.DEEPSEEK.API_KEY;

export const getAimlApiKey = () => loadConfig().MODELS.AIMLAPI.API_KEY;

export const getCustomOpenaiApiKey = () =>
  loadConfig().MODELS.CUSTOM_OPENAI.API_KEY;

export const getCustomOpenaiApiUrl = () =>
  loadConfig().MODELS.CUSTOM_OPENAI.API_URL;

export const getCustomOpenaiModelName = () =>
  loadConfig().MODELS.CUSTOM_OPENAI.MODEL_NAME;

export const getLMStudioApiEndpoint = () =>
  loadConfig().MODELS.LM_STUDIO.API_URL;

export const getLemonadeApiEndpoint = () =>
  loadConfig().MODELS.LEMONADE.API_URL;

export const getLemonadeApiKey = () => loadConfig().MODELS.LEMONADE.API_KEY;

// Memory configuration getters
export const getMemoryEnabled = () => {
  try {
    return loadConfig().MEMORY?.ENABLED ?? false;
  } catch (error) {
    return false;
  }
};

export const getMemoryProvider = () => {
  try {
    return loadConfig().MEMORY?.PROVIDER ?? 'cloud';
  } catch (error) {
    return 'cloud';
  }
};

export const getMemoryCloudConfig = () => {
  try {
    return loadConfig().MEMORY?.CLOUD ?? {};
  } catch (error) {
    return {};
  }
};

export const getMemorySelfHostedConfig = () => {
  try {
    return loadConfig().MEMORY?.SELF_HOSTED ?? {};
  } catch (error) {
    return {};
  }
};

export const getMemoryStorageConfig = () => {
  try {
    return loadConfig().MEMORY?.STORAGE ?? {
      RETENTION_DAYS: 365,
      MAX_MEMORIES_PER_USER: 10000,
      AUTO_CLEANUP: true,
    };
  } catch (error) {
    return {
      RETENTION_DAYS: 365,
      MAX_MEMORIES_PER_USER: 10000,
      AUTO_CLEANUP: true,
    };
  }
};

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
  // Server-side only
  if (typeof window === 'undefined') {
    const currentConfig = loadConfig();
    const mergedConfig = mergeConfigs(currentConfig, config);
    fs.writeFileSync(
      path.join(path.join(process.cwd(), `${configFileName}`)),
      toml.stringify(mergedConfig),
    );
  }
};
