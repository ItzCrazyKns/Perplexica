import { ChatAnthropic } from '@langchain/anthropic';
   import { ChatMessage } from 'langchain/schema';

   class RetryingChatAnthropic extends ChatAnthropic {
     maxRetries: number;
     baseDelay: number;

     constructor(config: ConstructorParameters<typeof ChatAnthropic>[0] & { maxRetries?: number; baseDelay?: number }) {
       super(config);
       this.maxRetries = config.maxRetries || 3;
       this.baseDelay = config.baseDelay || 1000;
     }

     async _call(messages: ChatMessage[], options: this['ParsedCallOptions'], runManager?: any): Promise<string> {
       let lastError: Error | undefined;
       for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
         try {
           return await super._call(messages, options, runManager);
         } catch (error) {
           if (!(error instanceof Error && error.name === 'APIConnectionError') || attempt === this.maxRetries) {
             throw error;
           }
           lastError = error;
           const delay = this.calculateDelay(attempt);
           console.warn(`APIConnectionError in ${this.modelName}: ${error.message}. Retrying in ${delay}ms. Attempt ${attempt + 1} of ${this.maxRetries + 1}`);
           await this.wait(delay);
         }
       }
       throw lastError;
     }

     private calculateDelay(attempt: number): number {
       const jitter = Math.random() * 0.1 * this.baseDelay;
       return Math.min(
         (Math.pow(2, attempt) * this.baseDelay) + jitter,
         30000
       );
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

   async function testRetryLogic(): Promise<void> {
     try {
       const claude = await loadAnthropicChatModel();
       console.log("Model initialized successfully. Attempting API call...");

       const result = await claude.call([
         { content: "Hello, Claude! Please provide a brief summary of your capabilities.", role: "human" }
       ]);

       console.log("API call succeeded. Response:");
       console.log(result);
     } catch (error) {
       console.error("Error occurred:", error);
     }
   }

   testRetryLogic();