import { ChatAnthropic } from '@langchain/anthropic';
import { ChatModel } from '.';
import { getAnthropicApiKey } from '../config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export const PROVIDER_INFO = {
  key: 'anthropic',
  displayName: 'Anthropic',
};

const anthropicChatModels: Record<string, string>[] = [
  {
    displayName: 'Claude 4.1 Opus',
    key: 'claude-opus-4-1-20250805',
  },
  {
    displayName: 'Claude 4 Opus',
    key: 'claude-opus-4-20250514',
  },
  {
    displayName: 'Claude 4 Sonnet',
    key: 'claude-sonnet-4-20250514',
  },
  {
    displayName: 'Claude 4.5 Sonnet',
    key: 'claude-sonnet-4-5-20250929',
  },
  {
    displayName: 'Claude 4.5 Haiku',
    key: 'claude-haiku-4-5-20251001',
  },
  {
    displayName: 'Claude 3.7 Sonnet',
    key: 'claude-3-7-sonnet-20250219',
  },
  {
    displayName: 'Claude 3.5 Haiku',
    key: 'claude-3-5-haiku-20241022',
  },
  {
    displayName: 'Claude 3.5 Sonnet v2',
    key: 'claude-3-5-sonnet-20241022',
  },
  {
    displayName: 'Claude 3.5 Sonnet',
    key: 'claude-3-5-sonnet-20240620',
  },
  {
    displayName: 'Claude 3 Opus',
    key: 'claude-3-opus-20240229',
  },
  {
    displayName: 'Claude 3 Sonnet',
    key: 'claude-3-sonnet-20240229',
  },
  {
    displayName: 'Claude 3 Haiku',
    key: 'claude-3-haiku-20240307',
  },
];

export const loadAnthropicChatModels = async () => {
  const anthropicApiKey = getAnthropicApiKey();

  if (!anthropicApiKey) return {};

  try {
    const chatModels: Record<string, ChatModel> = {};

    anthropicChatModels.forEach((model) => {
      const baseConfig: any = {
        apiKey: anthropicApiKey,
        modelName: model.key,
      };

      const chatModel = new ChatAnthropic(baseConfig) as unknown as BaseChatModel;

      if ((chatModel as any).temperature !== undefined) {
        delete (chatModel as any).temperature;
      }
      if ((chatModel as any).topP !== undefined) {
        delete (chatModel as any).topP;
      }
      if ((chatModel as any).top_p !== undefined) {
        delete (chatModel as any).top_p;
      }

      chatModels[model.key] = {
        displayName: model.displayName,
        model: chatModel,
      };
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading Anthropic models: ${err}`);
    return {};
  }
};
