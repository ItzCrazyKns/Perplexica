import express from 'express';
import {
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '../lib/providers';
import {
  getGroqApiKey,
  getOllamaApiEndpoint,
  getAnthropicApiKey,
  getGeminiApiKey,
  getOpenaiApiKey,
  updateConfig,
  getCustomOpenaiApiUrl,
  getCustomOpenaiApiKey,
  getCustomOpenaiModelName,
  getSearchEngineBackend,
  getImageSearchEngineBackend,
  getVideoSearchEngineBackend,
  getNewsSearchEngineBackend,
  getSearxngApiEndpoint,
  getGoogleApiKey,
  getGoogleCseId,
  getBingSubscriptionKey,
  getBraveApiKey,
  getYacyJsonEndpoint,
} from '../config';
import logger from '../utils/logger';

const router = express.Router();

router.get('/', async (_, res) => {
  try {
    const config = {};

    const [chatModelProviders, embeddingModelProviders] = await Promise.all([
      getAvailableChatModelProviders(),
      getAvailableEmbeddingModelProviders(),
    ]);

    config['chatModelProviders'] = {};
    config['embeddingModelProviders'] = {};

    for (const provider in chatModelProviders) {
      config['chatModelProviders'][provider] = Object.keys(
        chatModelProviders[provider],
      ).map((model) => {
        return {
          name: model,
          displayName: chatModelProviders[provider][model].displayName,
        };
      });
    }

    for (const provider in embeddingModelProviders) {
      config['embeddingModelProviders'][provider] = Object.keys(
        embeddingModelProviders[provider],
      ).map((model) => {
        return {
          name: model,
          displayName: embeddingModelProviders[provider][model].displayName,
        };
      });
    }

    config['openaiApiKey'] = getOpenaiApiKey();
    config['ollamaApiUrl'] = getOllamaApiEndpoint();
    config['anthropicApiKey'] = getAnthropicApiKey();
    config['groqApiKey'] = getGroqApiKey();
    config['geminiApiKey'] = getGeminiApiKey();
    config['customOpenaiApiUrl'] = getCustomOpenaiApiUrl();
    config['customOpenaiApiKey'] = getCustomOpenaiApiKey();
    config['customOpenaiModelName'] = getCustomOpenaiModelName();
    
    // Add search engine configuration
    config['searchEngineBackends'] = {
      search: getSearchEngineBackend(),
      image: getImageSearchEngineBackend(),
      video: getVideoSearchEngineBackend(),
      news: getNewsSearchEngineBackend(),
    };
    
    config['searxngEndpoint'] = getSearxngApiEndpoint();
    config['googleApiKey'] = getGoogleApiKey();
    config['googleCseId'] = getGoogleCseId();
    config['bingSubscriptionKey'] = getBingSubscriptionKey();
    config['braveApiKey'] = getBraveApiKey();
    config['yacyEndpoint'] = getYacyJsonEndpoint();

    res.status(200).json(config);
  } catch (err: any) {
    res.status(500).json({ message: 'An error has occurred.' });
    logger.error(`Error getting config: ${err.message}`);
  }
});

router.post('/', async (req, res) => {
  const config = req.body;

  const updatedConfig = {
    MODELS: {
      OPENAI: {
        API_KEY: config.openaiApiKey,
      },
      GROQ: {
        API_KEY: config.groqApiKey,
      },
      ANTHROPIC: {
        API_KEY: config.anthropicApiKey,
      },
      GEMINI: {
        API_KEY: config.geminiApiKey,
      },
      OLLAMA: {
        API_URL: config.ollamaApiUrl,
      },
      CUSTOM_OPENAI: {
        API_URL: config.customOpenaiApiUrl,
        API_KEY: config.customOpenaiApiKey,
        MODEL_NAME: config.customOpenaiModelName,
      },
    },
    SEARCH_ENGINE_BACKENDS: config.searchEngineBackends ? {
      SEARCH: config.searchEngineBackends.search,
      IMAGE: config.searchEngineBackends.image,
      VIDEO: config.searchEngineBackends.video,
      NEWS: config.searchEngineBackends.news,
    } : undefined,
    SEARCH_ENGINES: {
      GOOGLE: {
        API_KEY: config.googleApiKey,
        CSE_ID: config.googleCseId,
      },
      SEARXNG: {
        ENDPOINT: config.searxngEndpoint,
      },
      BING: {
        SUBSCRIPTION_KEY: config.bingSubscriptionKey,
      },
      BRAVE: {
        API_KEY: config.braveApiKey,
      },
      YACY: {
        ENDPOINT: config.yacyEndpoint,
      },
    },
  };

  updateConfig(updatedConfig);

  res.status(200).json({ message: 'Config updated' });
});

export default router;
