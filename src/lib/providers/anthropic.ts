import { ChatAnthropic } from '@langchain/anthropic';
import { getAnthropicApiKey } from '../../config';
import logger from '../../utils/logger';

class RetryingChatAnthropic extends ChatAnthropic {
  constructor(config) {
    super(config);
    this.maxRetries = config.maxRetries || 3;
    this.baseDelay = config.baseDelay || 1000; // 1 second
  }

  async _call(messages, options, runManager) {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await super._call(messages, options, runManager);
      } catch (error) {
        if (error.name !== 'APIConnectionError' || attempt === this.maxRetries) {
          throw error; // Rethrow if it's not an APIConnectionError or if we're out of retries
        }
        lastError = error;
        const delay = this.calculateDelay(attempt);
        logger.warn(`APIConnectionError in ${this.model}: ${error.message}. Retrying in ${delay}ms. Attempt ${attempt + 1} of ${this.maxRetries + 1}`);
        await this.wait(delay);
      }
    }
    throw lastError; // This line should never be reached, but it's here for completeness
  }

  calculateDelay(attempt) {
    const jitter = Math.random() * 0.1 * this.baseDelay; // 10% jitter
    return Math.min(
      (Math.pow(2, attempt) * this.baseDelay) + jitter,
      30000 // Cap at 30 seconds
    );
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const loadAnthropicChatModels = async () => {
  const anthropicApiKey = getAnthropicApiKey();
  if (!anthropicApiKey) {
    logger.warn('Anthropic API key not found');
    return {};
  }

  const modelConfigs = [
    { name: 'Claude 3.5 Sonnet', model: 'claude-3-5-sonnet-20240620' },
    { name: 'Claude 3 Opus', model: 'claude-3-opus-20240229' },
    { name: 'Claude 3 Sonnet', model: 'claude-3-sonnet-20240229' },
    { name: 'Claude 3 Haiku', model: 'claude-3-haiku-20240307' }
  ];

  const chatModels = {};

  for (const config of modelConfigs) {
    try {
      chatModels[config.name] = new RetryingChatAnthropic({
        temperature: 0.7,
        anthropicApiKey,
        model: config.model,
        maxRetries: 3,
        baseDelay: 1000,
      });
      logger.info(`Successfully initialized ${config.name} with retry logic`);
    } catch (err) {
      logger.error(`Error initializing ${config.name}: ${err.message}`);
    }
  }

  return chatModels;
};
