import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import {
  getKeepAlive,
  getOllamaApiEndpoint,
  getOllamaChatOptions,
  getOllamaEmbeddingsParams,
} from '../../config';
import logger from '../../utils/logger';
import { ChatOllama } from '@langchain/community/chat_models/ollama';
import axios from 'axios';

export const loadOllamaChatModels = async () => {
  const ollamaEndpoint = getOllamaApiEndpoint();
  const ollamaChatOptions = getOllamaChatOptions();
  const keepAlive = getKeepAlive();

  if (!ollamaEndpoint) return {};

  try {
    const response = await axios.get(`${ollamaEndpoint}/api/tags`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const { models: ollamaModels } = response.data;

    const chatModels = ollamaModels.reduce((acc, model) => {
      acc[model.model] = {
        displayName: model.name,
        model: new ChatOllama({
          ...ollamaChatOptions, // merge the options specified via config
          ...{
            // things defined in this dictionary will take precendence
            baseUrl: ollamaEndpoint,
            model: model.model,
            temperature: 0.7,
            keepAlive: keepAlive,
          },
        }),
      };

      return acc;
    }, {});

    return chatModels;
  } catch (err) {
    logger.error(`Error loading Ollama models: ${err}`);
    return {};
  }
};

export const loadOllamaEmbeddingsModels = async () => {
  const ollamaEndpoint = getOllamaApiEndpoint();
  const ollamaEmbeddingParams = getOllamaEmbeddingsParams();

  if (!ollamaEndpoint) return {};

  try {
    const response = await axios.get(`${ollamaEndpoint}/api/tags`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const { models: ollamaModels } = response.data;

    const embeddingsModels = ollamaModels.reduce((acc, model) => {
      acc[model.model] = {
        displayName: model.name,
        model: new OllamaEmbeddings({
          ...ollamaEmbeddingParams, // merge the options specified via config
          ...{
            // things defined in this dictionary will take precendence
            baseUrl: ollamaEndpoint,
            model: model.model,
          },
        }),
      };

      return acc;
    }, {});

    return embeddingsModels;
  } catch (err) {
    logger.error(`Error loading Ollama embeddings model: ${err}`);
    return {};
  }
};
