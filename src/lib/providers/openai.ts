import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { getOpenaiApiKey } from '../config';
import { ChatModel, EmbeddingModel } from '.';

export const PROVIDER_INFO = {
  key: 'openai',
  displayName: 'OpenAI',
};
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';

const OPENAI_MODELS_ENDPOINT = 'https://api.openai.com/v1/models';

async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
  const resp = await fetch(OPENAI_MODELS_ENDPOINT, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!resp.ok) {
    throw new Error(`OpenAI models endpoint returned ${resp.status}`);
  }

  const data = await resp.json();

  if (!data || !Array.isArray(data.data)) {
    throw new Error('Unexpected OpenAI models response format');
  }

  return data.data
    .map((model: any) => (model && model.id ? String(model.id) : undefined))
    .filter(Boolean) as string[];
}

export const loadOpenAIChatModels = async () => {
  const openaiApiKey = getOpenaiApiKey();

  if (!openaiApiKey) return {};

  try {
    const modelIds = (await fetchOpenAIModels(openaiApiKey)).sort((a, b) =>
      a.localeCompare(b),
    );

    const chatModels: Record<string, ChatModel> = {};

    modelIds.forEach((model) => {
      const lid = model.toLowerCase();
      const excludedSubstrings = [
        'audio',
        'embedding',
        'image',
        'omni-moderation',
        'transcribe',
        'tts',
      ];
      const isChat =
        (lid.startsWith('gpt') || lid.startsWith('o')) &&
        !excludedSubstrings.some((s) => lid.includes(s));

      if (!isChat) return;

      chatModels[model] = {
        displayName: model,
        model: new ChatOpenAI({
          apiKey: openaiApiKey,
          modelName: model,
          temperature: model.includes('gpt-5') ? 1 : 0.7,
        }) as unknown as BaseChatModel,
      };
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading OpenAI chat models: ${err}`);
    return {};
  }
};

export const loadOpenAIEmbeddingModels = async () => {
  const openaiApiKey = getOpenaiApiKey();

  if (!openaiApiKey) return {};

  try {
    const modelIds = (await fetchOpenAIModels(openaiApiKey)).sort((a, b) =>
      a.localeCompare(b),
    );

    const embeddingModels: Record<string, EmbeddingModel> = {};

    modelIds.forEach((model) => {
      const lid = model.toLowerCase();

      const isEmbedding = lid.includes('embedding');

      if (!isEmbedding) return;

      embeddingModels[model] = {
        displayName: model,
        model: new OpenAIEmbeddings({
          apiKey: openaiApiKey,
          modelName: model,
        }) as unknown as Embeddings,
      };
    });

    return embeddingModels;
  } catch (err) {
    console.error(`Error loading OpenAI embedding models: ${err}`);
    return {};
  }
};
