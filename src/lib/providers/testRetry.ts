import { ChatAnthropic } from '@langchain/anthropic';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import axios from 'axios'; // We'll use axios to make a separate API call to identify our IP

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
        console.log(`Attempt ${attempt + 1}: Making API call to Anthropic...`);
        const result = await super.call(messages, options);
        console.log(`Attempt ${attempt + 1}: API call successful.`);
        return result;
      } catch (error) {
        lastError = error;
        console.error(`Full error object: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
        
        if (this.isRetryableError(error) && attempt < this.maxRetries) {
          const delay = this.calculateDelay(attempt);
          console.warn(`Attempt ${attempt + 1}: Retryable error occurred. Retrying in ${delay}ms.`);
          await this.wait(delay);
        } else {
          console.error(`Attempt ${attempt + 1}: Non-retryable error or max retries reached.`);
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

const loadAnthropicChatModel = async (): Promise<RetryingChatAnthropic> => {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not found in environment variables');
  }

  return new RetryingChatAnthropic({
    temperature: 0.7,
    anthropicApiKey,
    modelName: 'claude-3-sonnet-20240229',
    maxRetries: 3,
    baseDelay: 1000,
  });
};

async function getPublicIP(): Promise<string> {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    console.error('Error fetching public IP:', error);
    return 'Unknown';
  }
}

async function testRetryLogic(): Promise<void> {
  try {
    const claude = await loadAnthropicChatModel();
    console.log("Model initialized successfully. Attempting API call...");

    const result = await claude.call([
      new HumanMessage("Hello, Claude! Please provide a brief summary of your capabilities.")
    ]);

    console.log("\nAPI call succeeded. Response:");
    console.log(result.content);
  } catch (error) {
    console.error("\nError occurred:");
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else if (typeof error === 'object' && error !== null) {
      console.error("Anthropic API Error:", JSON.stringify(error, null, 2));
    } else {
      console.error("Unexpected error:", error);
    }
  }
}

console.log('Starting retry logic test...');
testRetryLogic();