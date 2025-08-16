import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { getGeminiApiKey } from '../config';
import { ChatModel, EmbeddingModel } from '.';

export const PROVIDER_INFO = {
  key: 'gemini',
  displayName: 'Google Gemini',
};
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';

// Replace static model lists with dynamic fetch from Gemini API
const GEMINI_MODELS_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models';

async function fetchGeminiModels(apiKey: string): Promise<any[]> {
  const url = `${GEMINI_MODELS_ENDPOINT}?key=${encodeURIComponent(
    apiKey,
  )}&pageSize=1000`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!resp.ok) {
    throw new Error(`Gemini models endpoint returned ${resp.status}`);
  }

  const data = await resp.json();

  if (!data || !Array.isArray(data.models)) {
    throw new Error('Unexpected Gemini models response format');
  }

  return data.models;
}

export const loadGeminiChatModels = async () => {
  const geminiApiKey = getGeminiApiKey();

  if (!geminiApiKey) return {};

  try {
    const models = await fetchGeminiModels(geminiApiKey);
    const geminiChatModels = models
      .map((model: any) => {
        const rawName = model && model.name ? String(model.name) : '';
        const stripped = rawName.replace(/^models\//i, '');
        return {
          rawName,
          key: stripped,
          displayName:
            model && model.displayName ? String(model.displayName) : stripped,
        };
      })
      .filter((model: any) => {
        const key = model.key.toLowerCase();
        const display = (model.displayName || '').toLowerCase();
        const excluded = ['audio', 'embedding', 'image', 'tts'];
        return (
          key.startsWith('gemini') &&
          !excluded.some((s) => key.includes(s) || display.includes(s))
        );
      })
      .sort((a: any, b: any) => a.key.localeCompare(b.key));

    const chatModels: Record<string, ChatModel> = {};

    geminiChatModels.forEach((model: any) => {
      chatModels[model.key] = {
        displayName: model.displayName,
        model: new ChatGoogleGenerativeAI({
          apiKey: geminiApiKey,
          model: model.key,
          // temperature: 0.7,
        }) as unknown as BaseChatModel,
      };
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading Gemini chat models: ${err}`);
    return {};
  }
};

export const loadGeminiEmbeddingModels = async () => {
  const geminiApiKey = getGeminiApiKey();

  if (!geminiApiKey) return {};

  try {
    const models = await fetchGeminiModels(geminiApiKey);
    const geminiEmbeddingModels = models
      .map((model: any) => {
        const rawName = model && model.name ? String(model.name) : '';
        const display =
          model && model.displayName ? String(model.displayName) : rawName;
        return {
          rawName,
          key: rawName,
          displayName: display,
        };
      })
      .filter(
        (model: any) =>
          model.key.toLowerCase().includes('embedding') ||
          model.displayName.toLowerCase().includes('embedding'),
      )
      .sort((a: any, b: any) => a.key.localeCompare(b.key));

    const embeddingModels: Record<string, EmbeddingModel> = {};

    geminiEmbeddingModels.forEach((model: any) => {
      embeddingModels[model.key] = {
        displayName: model.displayName,
        model: new GoogleGenerativeAIEmbeddings({
          apiKey: geminiApiKey,
          modelName: model.key,
        }) as unknown as Embeddings,
      };
    });

    return embeddingModels;
  } catch (err) {
    console.error(`Error loading Gemini embedding models: ${err}`);
    return {};
  }
};
