import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...classes: ClassValue[]) => twMerge(clsx(...classes));

export const formatProviderName = (provider: string): string => {
  // Mapping of provider keys to their properly formatted display names
  const providerNameMap: Record<string, string> = {
    // Providers
    'openai': 'OpenAI',
    'groq': 'Groq',
    'anthropic': 'Anthropic',
    'gemini': 'Gemini',
    'ollama': 'Ollama',
    'deepseek': 'DeepSeek',
    'lm_studio': 'LM Studio',
    'custom_openai': 'Custom OpenAI',
    'transformers': 'Transformers',
    'nvidia': 'NVIDIA',
    'openrouter': 'OpenRouter',
    'together': 'Together AI',
    'together_ai': 'Together AI',
    'mistral': 'Mistral AI',
    'mistral_ai': 'Mistral AI',
    'le_chat_mistral': 'Le Chat Mistral',
    'xai': 'xAI',
    'grok': 'Grok',
    'cohere': 'Cohere',
    'ai21': 'AI21 Labs',
    'ai21_labs': 'AI21 Labs',
    'huggingface': 'Hugging Face',
    'hugging_face': 'Hugging Face',
    'replicate': 'Replicate',
    'stability': 'Stability AI',
    'stability_ai': 'Stability AI',
    'perplexity': 'Perplexity AI',
    'perplexity_ai': 'Perplexity AI',
    'claude': 'Claude',
    'azure_openai': 'Azure OpenAI',
    'amazon': 'Amazon Bedrock',
    'bedrock': 'Amazon Bedrock',
    'amazon_bedrock': 'Amazon Bedrock',
    'vertex': 'Vertex AI',
    'vertex_ai': 'Vertex AI',
    'google': 'Google AI',
    'google_ai': 'Google AI',
    'meta': 'Meta AI',
    'meta_ai': 'Meta AI',
    'llama': 'Llama',
    'falcon': 'Falcon',
    'aleph_alpha': 'Aleph Alpha',
    'forefront': 'Forefront AI',
    'forefront_ai': 'Forefront AI'
  };

  // Return the mapped name if it exists
  if (provider in providerNameMap) {
    return providerNameMap[provider];
  }

  // Default formatting for unknown providers:
  // 1. Replace underscores with spaces
  // 2. Capitalize each word
  return provider
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const formatTimeDifference = (
  date1: Date | string,
  date2: Date | string,
): string => {
  date1 = new Date(date1);
  date2 = new Date(date2);

  const diffInSeconds = Math.floor(
    Math.abs(date2.getTime() - date1.getTime()) / 1000,
  );

  if (diffInSeconds < 60)
    return `${diffInSeconds} second${diffInSeconds !== 1 ? 's' : ''}`;
  else if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minute${Math.floor(diffInSeconds / 60) !== 1 ? 's' : ''}`;
  else if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) !== 1 ? 's' : ''}`;
  else if (diffInSeconds < 31536000)
    return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) !== 1 ? 's' : ''}`;
  else
    return `${Math.floor(diffInSeconds / 31536000)} year${Math.floor(diffInSeconds / 31536000) !== 1 ? 's' : ''}`;
};
