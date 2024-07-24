import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { getGeminiApiKey } from '../../config';
import logger from '../../utils/logger';

export const loadGeminiChatModels = async () => {
  const geminiApiKey = getGeminiApiKey();

  if (!geminiApiKey) return {};

  try {
    const chatModels = {
      'Gemini Pro': new ChatGoogleGenerativeAI({
        temperature: 0.7,
        apiKey: geminiApiKey,
        modelName: 'gemini-pro',
      }),
    };

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
    const embeddingsModels = {
      'Gemini Embedding': new GoogleGenerativeAIEmbeddings({
        apiKey: geminiApiKey,
        modelName: 'embedding-001',
      }),
    };

    return embeddingsModels;
  } catch (err) {
    logger.error(`Error loading Gemini embeddings model: ${err}`);
    return {};
  }
};
