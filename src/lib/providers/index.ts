import { loadGroqChatModels } from './groq';
import { loadOllamaChatModels, loadOllamaEmbeddingsModels } from './ollama';
import { loadOpenAIChatModels, loadOpenAIEmbeddingsModels } from './openai';
import { loadAzureOpenAIChatModels, loadAzureOpenAIEmbeddings } from './azure';
import { loadAnthropicChatModels } from './anthropic';
import { loadTransformersEmbeddingsModels } from './transformers';

const chatModelProviders = {
  openai: loadOpenAIChatModels,
  azure: loadAzureOpenAIChatModels,
  groq: loadGroqChatModels,
  ollama: loadOllamaChatModels,
  anthropic: loadAnthropicChatModels,
};

const embeddingModelProviders = {
  openai: loadOpenAIEmbeddingsModels,
  azure: loadAzureOpenAIEmbeddings,
  local: loadTransformersEmbeddingsModels,
  ollama: loadOllamaEmbeddingsModels,
};

export const getAvailableChatModelProviders = async () => {
  const models = {};

  for (const provider in chatModelProviders) {
    const providerModels = await chatModelProviders[provider]();
    if (Object.keys(providerModels).length > 0) {
      models[provider] = providerModels;
    }
  }

  models['custom_openai'] = {};

  return models;
};

export const getAvailableEmbeddingModelProviders = async () => {
  const models = {};

  for (const provider in embeddingModelProviders) {
    const providerModels = await embeddingModelProviders[provider]();
    if (Object.keys(providerModels).length > 0) {
      models[provider] = providerModels;
    }
  }

  return models;
};
