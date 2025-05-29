import axios from 'axios';
import { getKeepAlive, getOllamaApiEndpoint, getOllamaApiKey, getOllamaModelName } from '../config';
import { ChatModel, EmbeddingModel } from '.';

export const PROVIDER_INFO = {
  key: 'ollama',
  displayName: 'Ollama',
};
import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { get } from 'http';

const getOllamaHttpHeaders = (): Record<string, string> => {
  const result: Record<string, string> = {};

  if (getOllamaApiKey()) {
    result["Authorization"] = `Bearer ${getOllamaApiKey()}`;
  }
  if (process.env.OLLAMA_API_KEY) {
    result["Authorization"] = `Bearer ${process.env.OLLAMA_API_KEY}`;
  }

  return result;
};

export const loadOllamaChatModels = async () => {
  const ollamaApiEndpoint = getOllamaApiEndpoint();

  if (!ollamaApiEndpoint) return {};

  try {
    const res = await axios.get(`${ollamaApiEndpoint}/api/tags`, {
      headers: {
        'Content-Type': 'application/json',
        ...getOllamaHttpHeaders(),
      },
    });

    const { models } = res.data;

    const chatModels: Record<string, ChatModel> = {};

    models.forEach((model: any) => {
      if (getOllamaModelName() && !model.model.startsWith(getOllamaModelName())) {
        return; // Skip models that do not match the configured model name
      }
      chatModels[model.model] = {
        displayName: model.name,
        model: new ChatOllama({
          baseUrl: ollamaApiEndpoint,
          model: model.model,
          temperature: 0.7,
          keepAlive: getKeepAlive(),
          headers: getOllamaHttpHeaders(),
        }),
      };
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading Ollama models: ${err}`);
    return {};
  }
};

export const loadOllamaEmbeddingModels = async () => {
  const ollamaApiEndpoint = getOllamaApiEndpoint();

  if (!ollamaApiEndpoint) return {};

  try {
    const res = await axios.get(`${ollamaApiEndpoint}/api/tags`, {
      headers: {
        'Content-Type': 'application/json',
        ...getOllamaHttpHeaders(),
      },
    });

    const { models } = res.data;

    const embeddingModels: Record<string, EmbeddingModel> = {};

    models.forEach((model: any) => {
      embeddingModels[model.model] = {
        displayName: model.name,
        model: new OllamaEmbeddings({
          baseUrl: ollamaApiEndpoint,
          model: model.model,
          headers: getOllamaHttpHeaders(),
        }),
      };
    });

    return embeddingModels;
  } catch (err) {
    console.error(`Error loading Ollama embeddings models: ${err}`);
    return {};
  }
};
