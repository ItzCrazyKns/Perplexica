import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { getKeepAlive, getLMStudioApiEndpoint } from '../../config';
import logger from '../../utils/logger';
import axios from 'axios';

interface LMStudioModel {
  id: string;
  // add other properties if LM Studio API provides them
}

interface ChatModelConfig {
  displayName: string;
  model: ChatOpenAI;
}

export const loadLMStudioChatModels = async (): Promise<Record<string, ChatModelConfig>> => {
  const lmStudioEndpoint = getLMStudioApiEndpoint();

  if (!lmStudioEndpoint) {
    logger.debug('LM Studio endpoint not configured, skipping');
    return {};
  }

  try {
    const response = await axios.get<{ data: LMStudioModel[] }>(`${lmStudioEndpoint}/models`, {
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
            baseURL: lmStudioEndpoint,
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

  try {
    const response = await axios.get(`${lmStudioEndpoint}/models`, {
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
            baseURL: lmStudioEndpoint,
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