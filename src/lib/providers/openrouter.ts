export const PROVIDER_INFO = {
  key: 'openrouter',
  displayName: 'OpenRouter',
};
import { ChatOpenAI } from '@langchain/openai';
import { getOpenrouterApiKey } from '../config';
import { ChatModel } from '.';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

let openrouterChatModels: Record<string, string>[] = [];

async function fetchModelList(): Promise<void> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data = await response.json();

    openrouterChatModels = data.data.map((model: any) => ({
      displayName: model.name,
      key: model.id,
    }));
  } catch (error) {
    console.error('Error fetching models:', error);
  }
}

export const loadOpenrouterChatModels = async () => {
  await fetchModelList();

  const openrouterApikey = getOpenrouterApiKey();

  if (!openrouterApikey) return {};

  try {
    const chatModels: Record<string, ChatModel> = {};

    openrouterChatModels.forEach((model) => {
      chatModels[model.key] = {
        displayName: model.displayName,
        model: new ChatOpenAI({
          openAIApiKey: openrouterApikey,
          modelName: model.key,
          temperature: 0.7,
          configuration: {
            baseURL: 'https://openrouter.ai/api/v1',
          },
        }) as unknown as BaseChatModel,
      };
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading Openrouter models: ${err}`);
    return {};
  }
};
