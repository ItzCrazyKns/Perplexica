import express from 'express';
import logger from '../utils/logger';
import {
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '../lib/providers';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [chatModelProvidersRaw, embeddingModelProvidersRaw] =
      await Promise.all([
        getAvailableChatModelProviders(),
        getAvailableEmbeddingModelProviders(),
      ]);

    const chatModelProviders = {};

    const chatModelProvidersKeys = Object.keys(chatModelProvidersRaw);
    chatModelProvidersKeys.forEach((provider) => {
      chatModelProviders[provider] = {};
      const models = Object.keys(chatModelProvidersRaw[provider]);
      models.forEach((model) => {
        chatModelProviders[provider][model] = {};
      });
    });

    const embeddingModelProviders = {};

    const embeddingModelProvidersKeys = Object.keys(embeddingModelProvidersRaw);
    embeddingModelProvidersKeys.forEach((provider) => {
      embeddingModelProviders[provider] = {};
      const models = Object.keys(embeddingModelProvidersRaw[provider]);
      models.forEach((model) => {
        embeddingModelProviders[provider][model] = {};
      });
    });

    Object.keys(chatModelProviders).forEach((provider) => {
      Object.keys(chatModelProviders[provider]).forEach((model) => {
        delete chatModelProviders[provider][model].model;
      });
    });

    Object.keys(embeddingModelProviders).forEach((provider) => {
      Object.keys(embeddingModelProviders[provider]).forEach((model) => {
        delete embeddingModelProviders[provider][model].model;
      });
    });

    res.status(200).json({ chatModelProviders, embeddingModelProviders });
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
    logger.error(err.message);
  }
});

export default router;
