import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { loadOpenAIChatModels, loadOpenAIEmbeddingModels } from './openai';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '../config';
import {
  getAzureOpenaiApiKey,
  getAzureOpenaiEndpoint,
  getAzureOpenaiModelName,
  getAzureOpenaiApiVersion,
} from '../config';
import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai';
import { loadOllamaChatModels, loadOllamaEmbeddingModels } from './ollama';
import { loadGroqChatModels } from './groq';
import { loadAnthropicChatModels } from './anthropic';
import { loadGeminiChatModels, loadGeminiEmbeddingModels } from './gemini';
import { loadTransformersEmbeddingsModels } from './transformers';
import { loadDeepseekChatModels } from './deepseek';
import Chat from '@/components/Chat';

export interface ChatModel {
  displayName: string;
  model: BaseChatModel;
}

export interface EmbeddingModel {
  displayName: string;
  model: Embeddings;
}

export const chatModelProviders: Record<
  string,
  () => Promise<Record<string, ChatModel>>
> = {
  openai: loadOpenAIChatModels,
  ollama: loadOllamaChatModels,
  groq: loadGroqChatModels,
  anthropic: loadAnthropicChatModels,
  gemini: loadGeminiChatModels,
  deepseek: loadDeepseekChatModels,
};

export const embeddingModelProviders: Record<
  string,
  () => Promise<Record<string, EmbeddingModel>>
> = {
  openai: loadOpenAIEmbeddingModels,
  ollama: loadOllamaEmbeddingModels,
  gemini: loadGeminiEmbeddingModels,
  transformers: loadTransformersEmbeddingsModels,
};

export const getAvailableChatModelProviders = async () => {
  const models: Record<string, Record<string, ChatModel>> = {};

  for (const provider in chatModelProviders) {
    const providerModels = await chatModelProviders[provider]();
    if (Object.keys(providerModels).length > 0) {
      models[provider] = providerModels;
    }
  }

  const customOpenAiApiKey = getCustomOpenaiApiKey();
  const customOpenAiApiUrl = getCustomOpenaiApiUrl();
  const customOpenAiModelName = getCustomOpenaiModelName();

  const azureOpenAiApiKey = getAzureOpenaiApiKey();
  const azureOpenAiModelName = getAzureOpenaiModelName();
  const azureOpenAiApiVersion = getAzureOpenaiApiVersion();
  const azureOpenAiEndpoint = getAzureOpenaiEndpoint();

  models['custom_openai'] = {
    ...(customOpenAiApiKey && customOpenAiApiUrl && customOpenAiModelName
      ? {
          [customOpenAiModelName]: {
            displayName: customOpenAiModelName,
            model: new ChatOpenAI({
              openAIApiKey: customOpenAiApiKey,
              modelName: customOpenAiModelName,
              temperature: 0.7,
              configuration: {
                baseURL: customOpenAiApiUrl,
              },
            }) as unknown as BaseChatModel,
          },
        }
      : {}),
  };

  models['azure_openai'] = {
    ...(azureOpenAiApiKey && azureOpenAiEndpoint && azureOpenAiApiVersion && azureOpenAiModelName
      ? {
        [azureOpenAiModelName]: {
          displayName: azureOpenAiModelName,
          model: new AzureChatOpenAI({
            openAIApiKey: azureOpenAiApiKey,
            deploymentName: azureOpenAiModelName,
            openAIBasePath: azureOpenAiEndpoint,
            openAIApiVersion: azureOpenAiApiVersion,
            temperature: 0.7
          }) as unknown as BaseChatModel
        },
      }
    : {}),
  }

  return models;
};

export const getAvailableEmbeddingModelProviders = async () => {
  const models: Record<string, Record<string, EmbeddingModel>> = {};

  for (const provider in embeddingModelProviders) {
    const providerModels = await embeddingModelProviders[provider]();
    if (Object.keys(providerModels).length > 0) {
      models[provider] = providerModels;
    }
  }

  return models;
};
