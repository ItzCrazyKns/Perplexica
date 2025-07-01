import { ChatOpenAI } from '@langchain/openai';
import { getGroqApiKey } from '../config';
import { ChatModel } from '.';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export const PROVIDER_INFO = {
  key: 'groq',
  displayName: 'Groq',
};

interface GroqModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  active: boolean;
  context_window: number;
  max_completion_tokens: number;
}

interface GroqModelsResponse {
  object: string;
  data: GroqModel[];
}

const generateDisplayName = (modelId: string, ownedBy: string): string => {
  // Handle special cases for better display names
  const modelMap: Record<string, string> = {
    'gemma2-9b-it': 'Gemma2 9B IT',
    'llama-3.3-70b-versatile': 'Llama 3.3 70B Versatile',
    'llama-3.1-8b-instant': 'Llama 3.1 8B Instant',
    'llama3-70b-8192': 'Llama3 70B 8192',
    'llama3-8b-8192': 'Llama3 8B 8192',
    'mixtral-8x7b-32768': 'Mixtral 8x7B 32768',
    'qwen-qwq-32b': 'Qwen QWQ 32B',
    'mistral-saba-24b': 'Mistral Saba 24B',
    'deepseek-r1-distill-llama-70b': 'DeepSeek R1 Distill Llama 70B',
    'deepseek-r1-distill-qwen-32b': 'DeepSeek R1 Distill Qwen 32B',
  };

  // Return mapped name if available
  if (modelMap[modelId]) {
    return modelMap[modelId];
  }

  // Generate display name from model ID
  let displayName = modelId
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Add owner info for certain models
  if (modelId.includes('meta-llama/')) {
    displayName = displayName.replace('Meta Llama/', '');
  }

  return displayName;
};

const fetchGroqModels = async (apiKey: string): Promise<GroqModel[]> => {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }

    const data: GroqModelsResponse = await response.json();
    
    // Filter for active chat completion models (exclude audio/whisper models)
    return data.data.filter(model => 
      model.active && 
      !model.id.includes('whisper') &&
      !model.id.includes('tts') &&
      !model.id.includes('guard') &&
      !model.id.includes('prompt-guard')
    );
  } catch (error) {
    console.error('Error fetching Groq models:', error);
    return [];
  }
};

export const loadGroqChatModels = async () => {
  const groqApiKey = getGroqApiKey();

  if (!groqApiKey) return {};

  try {
    const chatModels: Record<string, ChatModel> = {};

    // Fetch available models from Groq API
    const availableModels = await fetchGroqModels(groqApiKey);

    availableModels.forEach((model) => {
      chatModels[model.id] = {
        displayName: generateDisplayName(model.id, model.owned_by),
        model: new ChatOpenAI({
          openAIApiKey: groqApiKey,
          modelName: model.id,
          // temperature: 0.7,
          configuration: {
            baseURL: 'https://api.groq.com/openai/v1',
          },
        }) as unknown as BaseChatModel,
      };
    });

    return chatModels;
  } catch (err) {
    console.error(`Error loading Groq models: ${err}`);
    return {};
  }
};
