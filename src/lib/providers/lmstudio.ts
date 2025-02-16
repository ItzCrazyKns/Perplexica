import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { getKeepAlive, getLMStudioApiEndpoint } from '../../config';
import logger from '../../utils/logger';
import axios from 'axios';

const ensureV1Endpoint = (endpoint: string): string => {
  return endpoint.endsWith('/v1') ? endpoint : `${endpoint}/v1`;
};

interface LMStudioModel {
  id: string;
  // add other properties if LM Studio API provides them
}

interface ChatModelConfig {
  displayName: string;
  model: ChatOpenAI;
}

const checkLMStudioAvailability = async (endpoint: string): Promise<boolean> => {
  const v1Endpoint = ensureV1Endpoint(endpoint);
  try {
    await axios.get(`${v1Endpoint}/models`, {
      timeout: 1000, // 1 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return true;
  } catch (err) {
    logger.debug(`LM Studio server not available at ${endpoint}`);
    return false;
  }
};

export const loadLMStudioChatModels = async (): Promise<Record<string, ChatModelConfig>> => {
  const lmStudioEndpoint = getLMStudioApiEndpoint();

  if (!lmStudioEndpoint) {
    logger.debug('LM Studio endpoint not configured, skipping');
    return {};
  }

  // Check if server is available before attempting to load models
  const isAvailable = await checkLMStudioAvailability(lmStudioEndpoint);
  if (!isAvailable) {
    return {};
  }

  try {
    const v1Endpoint = ensureV1Endpoint(lmStudioEndpoint);
    const response = await axios.get<{ data: LMStudioModel[] }>(`${v1Endpoint}/models`, {
      timeout: 5000, // 5 second timeout for model loading
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const lmStudioModels = response.data.data;

    const chatModels = lmStudioModels.reduce<Record<string, ChatModelConfig>>((acc, model) => {
      acc[model.id] = {
        displayName: model.id,
        model: new ChatOpenAI({
          openAIApiKey: 'lm-studio',
          configuration: {
            baseURL: ensureV1Endpoint(lmStudioEndpoint),
          },
          modelName: model.id,
          temperature: 0.7,
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
  const lmStudioEndpoint = getLMStudioApiEndpoint();

  if (!lmStudioEndpoint) return {};

  // Check if server is available before attempting to load models
  const isAvailable = await checkLMStudioAvailability(lmStudioEndpoint);
  if (!isAvailable) {
    return {};
  }

  try {
    const v1Endpoint = ensureV1Endpoint(lmStudioEndpoint);
    const response = await axios.get(`${v1Endpoint}/models`, {
      timeout: 5000, // 5 second timeout for model loading
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const lmStudioModels = response.data.data;

    const embeddingsModels = lmStudioModels.reduce((acc, model) => {
      acc[model.id] = {
        displayName: model.id,
        model: new OpenAIEmbeddings({
          openAIApiKey: 'lm-studio', // Dummy key required by LangChain
          configuration: {
            baseURL: ensureV1Endpoint(lmStudioEndpoint),
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
