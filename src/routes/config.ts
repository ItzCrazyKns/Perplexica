import express from 'express';
import {
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '../lib/providers';
import {
  getGroqApiKey,
  getOllamaApiEndpoint,
  getAnthropicApiKey,
  getOpenaiApiKey,
  updateConfig,
  getConfigPassword,
  isLibraryEnabled,
  isCopilotEnabled,
  isDiscoverEnabled,
} from '../config';

const router = express.Router();

router.get('/', async (req, res) => {
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
    );
  }

  for (const provider in embeddingModelProviders) {
    config['embeddingModelProviders'][provider] = Object.keys(
      embeddingModelProviders[provider],
    );
  }

  config['openaiApiKey'] = getOpenaiApiKey();
  config['ollamaApiUrl'] = getOllamaApiEndpoint();
  config['anthropicApiKey'] = getAnthropicApiKey();
  config['groqApiKey'] = getGroqApiKey();
  config['isLibraryEnabled'] = isLibraryEnabled();
  config['isCopilotEnabled'] = isCopilotEnabled();
  config['isDiscoverEnabled'] = isDiscoverEnabled();

  res.status(200).json(config);
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
    API_KEYS: {
      OPENAI: config.openaiApiKey,
      GROQ: config.groqApiKey,
      ANTHROPIC: config.anthropicApiKey,
    },
    API_ENDPOINTS: {
      OLLAMA: config.ollamaApiUrl,
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
