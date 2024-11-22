import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { getGeminiApiKey } from '../../config';
import logger from '../../utils/logger';
import axios from 'axios';

interface GeminiModel {
  name: string;
  baseModelId: string;
  version: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: string[];
  temperature: number;
  maxTemperature: number;
  topP: number;
  topK: number;
}

interface GeminiModelsResponse {
  models: GeminiModel[];
  nextPageToken?: string;
}

const fetchGeminiModels = async (apiKey: string): Promise<GeminiModel[]> => {
  try {
    const response = await axios.get<GeminiModelsResponse>(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    return response.data.models;
  } catch (err) {
    logger.error(`Error fetching Gemini models: ${err}`);
    return [];
  }
};

export const loadGeminiChatModels = async () => {
  const geminiApiKey = getGeminiApiKey();

  if (!geminiApiKey) return {};

  try {
    const models = await fetchGeminiModels(geminiApiKey);
    const chatModels: Record<string, any> = {};

    // If no models are available from the API, fallback to default models
    if (!models.length) {
      chatModels['gemini-pro'] = {
        displayName: 'Gemini Pro',
        model: new ChatGoogleGenerativeAI({
          temperature: 0.7,
          apiKey: geminiApiKey,
          modelName: 'gemini-pro',
        }),
      };
      return chatModels;
    }

    for (const model of models) {
      if (model.supportedGenerationMethods.includes('generateContent')) {
        chatModels[model.name] = {
          displayName: model.displayName,
          model: new ChatGoogleGenerativeAI({
            temperature: model.temperature || 0.7,
            apiKey: geminiApiKey,
            modelName: model.baseModelId,
          }),
        };
      }
    }

    return chatModels;
  } catch (err) {
    logger.error(`Error loading Gemini chat models: ${err}`);
    return {};
  }
};

export const loadGeminiEmbeddingsModels = async () => {
  const geminiApiKey = getGeminiApiKey();

  if (!geminiApiKey) return {};

  try {
    const models = await fetchGeminiModels(geminiApiKey);
    const embeddingsModels: Record<string, any> = {};

    // If no models are available from the API, fallback to default models
    if (!models.length) {
      embeddingsModels['embedding-001'] = {
        displayName: 'Gemini Embedding',
        model: new GoogleGenerativeAIEmbeddings({
          apiKey: geminiApiKey,
          modelName: 'embedding-001',
        }),
      };
      return embeddingsModels;
    }

    for (const model of models) {
      if (model.supportedGenerationMethods.includes('embedContent')) {
        embeddingsModels[model.name] = {
          displayName: model.displayName,
          model: new GoogleGenerativeAIEmbeddings({
            apiKey: geminiApiKey,
            modelName: model.baseModelId,
          }),
        };
      }
    }

    return embeddingsModels;
  } catch (err) {
    logger.error(`Error loading Gemini embeddings model: ${err}`);
    return {};
  }
};