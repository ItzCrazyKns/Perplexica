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
  getConfigPassword,
  isLibraryEnabled,
  isCopilotEnabled,
  isDiscoverEnabled,
  getCustomOpenaiApiUrl,
  getCustomOpenaiApiKey,
  getCustomOpenaiModelName,
} from '../config';
import logger from '../utils/logger';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const authHeader = req.headers['authorization']?.split(' ')[1];
    const password = getConfigPassword();

    if (authHeader !== password) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

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

    res.status(200).json(config);
  } catch (err: any) {
    res.status(500).json({ message: 'An error has occurred.' });
    logger.error(`Error getting config: ${err.message}`);
  }
});

router.post('/', async (req, res) => {
  const authHeader = req.headers['authorization']?.split(' ')[1];
  const password = getConfigPassword();

  if (authHeader !== password) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const config = req.body;

  const updatedConfig = {
    GENERAL: {
      DISCOVER_ENABLED: config.isDiscoverEnabled,
      LIBRARY_ENABLED: config.isLibraryEnabled,
      COPILOT_ENABLED: config.isCopilotEnabled,
    },
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
  };

  updateConfig(updatedConfig);

  res.status(200).json({ message: 'Config updated' });
});

router.get('/preferences', (_, res) => {
  const preferences = {
    isLibraryEnabled: isLibraryEnabled(),
    isCopilotEnabled: isCopilotEnabled(),
    isDiscoverEnabled: isDiscoverEnabled(),
  };

  res.status(200).json(preferences);
});

export default router;
