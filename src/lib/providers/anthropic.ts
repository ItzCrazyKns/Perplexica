import { ChatAnthropic } from '@langchain/anthropic';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { getAnthropicApiKey } from '../../config';
import logger from '../../utils/logger';
import axios from 'axios';

class RetryingChatAnthropic extends ChatAnthropic {
  maxRetries: number;
  baseDelay: number;

  constructor(config: ConstructorParameters<typeof ChatAnthropic>[0] & { maxRetries?: number; baseDelay?: number }) {
    super(config);
    this.maxRetries = config.maxRetries || 3;
    this.baseDelay = config.baseDelay || 1000;
  }

  async call(messages: BaseMessage[], options?: this['ParsedCallOptions']): Promise<BaseMessage> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info(`Attempt ${attempt + 1}: Making API call to Anthropic...`);
        const result = await super.call(messages, options);
        logger.info(`Attempt ${attempt + 1}: API call successful.`);
        return result;
      } catch (error) {
        lastError = error;
        logger.error(`Full error object: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
        
        if (this.isRetryableError(error) && attempt < this.maxRetries) {
          const delay = this.calculateDelay(attempt);
          logger.warn(`Attempt ${attempt + 1}: Retryable error occurred. Retrying in ${delay}ms.`);
          await this.wait(delay);
        } else {
          logger.error(`Attempt ${attempt + 1}: Non-retryable error or max retries reached.`);
          throw error;
        }
      }
    }
    throw lastError;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Check for network-related errors
      if (error.message.includes('APIConnectionError') || 
          error.message.includes('ETIMEDOUT') || 
          error.message.includes('ENOTFOUND') ||
          error.message.includes('EBADF') ||
          error.message.includes('Connection error')) {
        return true;
      }
      
      // Check for specific API errors that might be retryable
      if (error.message.includes('rate limit') || 
          error.message.includes('timeout') || 
          error.message.includes('temporary failure')) {
        return true;
      }
    }
    
    // Check for Anthropic-specific error types
    const anthropicError = error as any;
    if (anthropicError.type === 'not_found_error' ||
        anthropicError.type === 'service_unavailable' ||
        anthropicError.type === 'timeout_error') {
      return true;
    }
    
    return false;
  }

  private calculateDelay(attempt: number): number {
    const jitter = Math.random() * 0.1 * this.baseDelay;
    return Math.min((Math.pow(2, attempt) * this.baseDelay) + jitter, 30000);
  }

  private wait(ms: number): Promise<void> {
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

  const chatModels: Record<string, RetryingChatAnthropic> = {};

  for (const config of modelConfigs) {
    try {
      chatModels[config.name] = new RetryingChatAnthropic({
        temperature: 0.5,
        anthropicApiKey,
        modelName: config.model,
        maxRetries: 3,
        baseDelay: 1000,
      });
      logger.info(`Successfully initialized ${config.name} with retry logic`);
    } catch (err) {
      logger.error(`Error initializing ${config.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return chatModels;
};

async function getPublicIP(): Promise<string> {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    logger.error('Error fetching public IP:', error);
    return 'Unknown';
  }
}

// Example usage (can be commented out or removed if not needed)
async function testRetryLogic(): Promise<void> {
  try {
    const chatModels = await loadAnthropicChatModels();
    const claude = chatModels['Claude 3.5 Sonnet'];
    if (!claude) {
      throw new Error('Claude 3.5 Sonnet model not initialized');
    }

    logger.info("Model initialized successfully. Attempting API call...");

    const result = await claude.call([
      new HumanMessage("Hello, Claude! Please provide a brief summary of your capabilities.")
    ]);

    logger.info("\nAPI call succeeded. Response:");
    logger.info(result.content);
  } catch (error) {
    logger.error("\nError occurred:");
    if (error instanceof Error) {
      logger.error("Error name:", error.name);
      logger.error("Error message:", error.message);
      logger.error("Error stack:", error.stack);
    } else if (typeof error === 'object' && error !== null) {
      logger.error("Anthropic API Error:", JSON.stringify(error, null, 2));
    } else {
      logger.error("Unexpected error:", error);
    }
  }
}

// Uncomment the following line to run the test
<<<<<<< HEAD
// testRetryLogic();
=======
// testRetryLogic();
>>>>>>> 2898775c6fc98f810ae96556fecfc20cf892fc3c
