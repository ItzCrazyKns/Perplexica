import express from 'express';
import { getAvailableProviders } from '../lib/providers';
import {
  getChatModel,
  getChatModelProvider,
  getOllamaApiEndpoint,
  getOpenaiApiKey,
  updateConfig,
} from '../config';

const router = express.Router();

router.get('/', async (_, res) => {
  try {
    const config = {};

    const providers = await getAvailableProviders();

    for (const provider in providers) {
      delete providers[provider]['embeddings'];
    }

    config['providers'] = {};

    for (const provider in providers) {
      config['providers'][provider] = Object.keys(providers[provider]);
    }

    config['selectedProvider'] = getChatModelProvider();
    config['selectedChatModel'] = getChatModel();

    config['openeaiApiKey'] = getOpenaiApiKey();
    config['ollamaApiUrl'] = getOllamaApiEndpoint();

    res.status(200).json(config);
  } catch (error) {
    console.error('Failed to retrieve configuration:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const config = req.body;

    const updatedConfig = {
      GENERAL: {
        CHAT_MODEL_PROVIDER: config.selectedProvider,
        CHAT_MODEL: config.selectedChatModel,
      },
      API_KEYS: {
        OPENAI: config.openeaiApiKey,
      },
      API_ENDPOINTS: {
        OLLAMA: config.ollamaApiUrl,
      },
    };

    updateConfig(updatedConfig);

    res.status(200).json({ message: 'Config updated' });
  } catch (error) {
    console.error('Failed to update configuration:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
