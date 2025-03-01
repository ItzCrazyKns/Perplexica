import { ReasoningChatModel } from '../reasoningChatModel';
import { ChatOpenAI } from '@langchain/openai';
import logger from '../../utils/logger';
import { getDeepseekApiKey, getDeepseekStreamDelay } from '../../config';
import axios from 'axios';

interface DeepSeekModel {
  id: string;
  object: string;
  owned_by: string;
}

interface ModelListResponse {
  object: 'list';
  data: DeepSeekModel[];
}

interface ChatModelConfig {
  displayName: string;
  model: ReasoningChatModel | ChatOpenAI;
}

const REASONING_MODELS = ['deepseek-reasoner'];

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'deepseek-reasoner': 'DeepSeek R1',
  'deepseek-chat': 'DeepSeek V3'
};

export const loadDeepSeekChatModels = async (): Promise<Record<string, ChatModelConfig>> => {
  const deepSeekEndpoint = 'https://api.deepseek.com'; 

  const apiKey = getDeepseekApiKey();
  if (!apiKey) return {}; 

  if (!deepSeekEndpoint || !apiKey) {
    return {};
  }

  try {
    const response = await axios.get<{ data: DeepSeekModel[] }>(`${deepSeekEndpoint}/models`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const deepSeekModels = response.data.data;

    const chatModels = deepSeekModels.reduce<Record<string, ChatModelConfig>>((acc, model) => {
      if (model.id in MODEL_DISPLAY_NAMES) {
        // Use ReasoningChatModel for models that need reasoning capabilities
        if (REASONING_MODELS.includes(model.id)) {
          const streamDelay = getDeepseekStreamDelay();
          
          acc[model.id] = {
            displayName: MODEL_DISPLAY_NAMES[model.id],
            model: new ReasoningChatModel({
              apiKey,
              baseURL: deepSeekEndpoint,
              modelName: model.id,
              temperature: 0.7,
              streamDelay // Use configured stream delay from config
            }),
          };
        } else {
          // Use standard ChatOpenAI for other models
          acc[model.id] = {
            displayName: MODEL_DISPLAY_NAMES[model.id],
            model: new ChatOpenAI({
              openAIApiKey: apiKey,
              configuration: {
                baseURL: deepSeekEndpoint,
              },
              modelName: model.id,
              temperature: 0.7,
            }),
          };
        }
      }
      return acc;
    }, {});

    return chatModels;
  } catch (err) {
    logger.error(`Error loading DeepSeek models: ${String(err)}`);
    return {};
  }
};
