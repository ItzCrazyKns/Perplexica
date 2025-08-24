import { ChatAnthropic } from '@langchain/anthropic';
import { ChatModel } from '.';
import { getAnthropicApiKey } from '../config';

export const PROVIDER_INFO = {
  key: 'anthropic',
  displayName: 'Anthropic',
};
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

const ANTHROPIC_MODELS_ENDPOINT = 'https://api.anthropic.com/v1/models';

async function fetchAnthropicModels(apiKey: string): Promise<any[]> {
  const resp = await fetch(ANTHROPIC_MODELS_ENDPOINT, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
  });

  if (!resp.ok) {
    throw new Error(`Anthropic models endpoint returned ${resp.status}`);
  }

  const data = await resp.json();
  if (!data || !Array.isArray(data.data)) {
    throw new Error('Unexpected Anthropic models response format');
  }

  return data.data;
}

export const loadAnthropicChatModels = async () => {
  const anthropicApiKey = getAnthropicApiKey();

  if (!anthropicApiKey) return {};

  try {
    const models = await fetchAnthropicModels(anthropicApiKey);
    const anthropicChatModels = models
      .map((model: any) => {
        const id = model && model.id ? String(model.id) : '';
        const display =
          model && model.display_name ? String(model.display_name) : id;
        return { id, display };
      })
      .filter((model: any) => model.id)
      .sort((a: any, b: any) => a.display.localeCompare(b.display));

    const chatModels: Record<string, ChatModel> = {};

    anthropicChatModels.forEach((model: any) => {
      chatModels[model.id] = {
        displayName: model.display,
        model: new ChatAnthropic({
          apiKey: anthropicApiKey,
          modelName: model.id,
          temperature: 0.7,
        }) as unknown as BaseChatModel,
      };
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading Anthropic models: ${err}`);
    return {};
  }
};
