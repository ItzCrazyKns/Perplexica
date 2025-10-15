import { ChatModel } from '.';
import { getBedrockRegion } from '../config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export const PROVIDER_INFO = {
  key: 'bedrock',
  displayName: 'AWS Bedrock',
};

const bedrockChatModels: Record<string, string>[] = [
  {
    displayName: 'Claude 4.5 Sonnet',
    key: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  },
  {
    displayName: 'Claude 4.5 Sonnet 1m context',
    key: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0:1m',
  },
  {
    displayName: 'Claude Opus 4.1',
    key: 'us.anthropic.claude-opus-4-1-20250805-v1:0',
  },
  {
    displayName: 'Claude 4 Opus',
    key: 'us.anthropic.claude-opus-4-20250514-v1:0',
  },
  {
    displayName: 'Claude 4.0 Sonnet',
    key: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  },
  {
    displayName: 'Claude 4.0 Sonnet 1m context',
    key: 'us.anthropic.claude-sonnet-4-20250514-v1:0:1m',
  },
  {
    displayName: 'Claude 3.7 Sonnet',
    key: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
  },
  {
    displayName: 'Claude 3.5 Sonnet v2',
    key: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  },
  {
    displayName: 'Claude 3.5 Sonnet',
    key: 'us.anthropic.claude-3-5-sonnet-20240620-v1:0',
  },
  {
    displayName: 'Claude 3.5 Haiku',
    key: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
  },
  {
    displayName: 'Claude 3 Opus',
    key: 'us.anthropic.claude-3-opus-20240229-v1:0',
  },
  {
    displayName: 'Claude 3 Sonnet',
    key: 'anthropic.claude-3-sonnet-20240229-v1:0',
  },
  {
    displayName: 'Claude 3 Haiku',
    key: 'us.anthropic.claude-3-haiku-20240307-v1:0',
  },
  {
    displayName: 'Claude Intelligent Router',
    key: 'default-prompt-router/anthropic.claude:1',
  },
  {
    displayName: 'Nova Micro',
    key: 'us.amazon.nova-micro-v1:0',
  },
  {
    displayName: 'Nova Lite',
    key: 'us.amazon.nova-lite-v1:0',
  },
  {
    displayName: 'Nova Pro',
    key: 'us.amazon.nova-pro-v1:0',
  },
  {
    displayName: 'Nova Premier',
    key: 'us.amazon.nova-premier-v1:0',
  },
  {
    displayName: 'GPT OSS 120B',
    key: 'openai.gpt-oss-120b-1:0',
  },
];

export const loadBedrockChatModels = async () => {
  // Only load on server side
  if (typeof window !== 'undefined') {
    return {};
  }

  const region = getBedrockRegion();

  if (!region) {
    console.log(
      'AWS Bedrock region not configured. Please set REGION in config.toml [MODELS.BEDROCK] section',
    );
    return {};
  }

  // Dynamic import to avoid client-side bundling issues
  const { BedrockChat } = await import(
    '@langchain/community/chat_models/bedrock'
  );

  const chatModels: Record<string, ChatModel> = {};

  bedrockChatModels.forEach((model) => {
    chatModels[model.key] = {
      displayName: model.displayName,
      model: new BedrockChat({
        region: region,
        model: model.key,
        temperature: 0.7,
      }) as unknown as BaseChatModel,
    };
  });
  console.log(
    `Loaded ${Object.keys(chatModels).length} AWS Bedrock models from region: ${region}`,
  );
  return chatModels;
};
