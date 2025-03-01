import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { getLMStudioApiEndpoint, getKeepAlive } from '../../config';
import logger from '../../utils/logger';
import axios from 'axios';

interface LMStudioModel {
  id: string;
  name?: string;
}

const ensureV1Endpoint = (endpoint: string): string => 
  endpoint.endsWith('/v1') ? endpoint : `${endpoint}/v1`;

const checkServerAvailability = async (endpoint: string): Promise<boolean> => {
  try {
    const keepAlive = getKeepAlive();
    await axios.get(`${ensureV1Endpoint(endpoint)}/models`, {
      timeout: parseInt(keepAlive) * 1000 || 5000,
      headers: { 'Content-Type': 'application/json' },
    });
    return true;
  } catch {
    return false;
  }
};

export const loadLMStudioChatModels = async () => {
  const endpoint = getLMStudioApiEndpoint();
  const keepAlive = getKeepAlive();
  
  if (!endpoint) return {};
  if (!await checkServerAvailability(endpoint)) return {};

  try {
    const response = await axios.get(`${ensureV1Endpoint(endpoint)}/models`, {
      timeout: parseInt(keepAlive) * 1000 || 5000,
      headers: { 'Content-Type': 'application/json' },
    });

    const chatModels = response.data.data.reduce((acc: Record<string, any>, model: LMStudioModel) => {
      acc[model.id] = {
        displayName: model.name || model.id,
        model: new ChatOpenAI({
          openAIApiKey: 'lm-studio',
          configuration: {
            baseURL: ensureV1Endpoint(endpoint),
          },
          modelName: model.id,
          temperature: 0.7,
          streaming: true,
          maxRetries: 3
        }),
      };
      return acc;
    }, {});

    return chatModels;
  } catch (err) {
    logger.error(`Error loading LM Studio models: ${err}`);
    return {};
  }
};

export const loadLMStudioEmbeddingsModels = async () => {
  const endpoint = getLMStudioApiEndpoint();
  const keepAlive = getKeepAlive();
  
  if (!endpoint) return {};
  if (!await checkServerAvailability(endpoint)) return {};

  try {
    const response = await axios.get(`${ensureV1Endpoint(endpoint)}/models`, {
      timeout: parseInt(keepAlive) * 1000 || 5000,
      headers: { 'Content-Type': 'application/json' },
    });

    const embeddingsModels = response.data.data.reduce((acc: Record<string, any>, model: LMStudioModel) => {
      acc[model.id] = {
        displayName: model.name || model.id,
        model: new OpenAIEmbeddings({
          openAIApiKey: 'lm-studio',
          configuration: {
            baseURL: ensureV1Endpoint(endpoint),
          },
          modelName: model.id,
        }),
      };
      return acc;
    }, {});

    return embeddingsModels;
  } catch (err) {
    logger.error(`Error loading LM Studio embeddings model: ${err}`);
    return {};
  }
};