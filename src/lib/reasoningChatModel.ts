import { BaseChatModel, BaseChatModelCallOptions } from '@langchain/core/language_models/chat_models';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { AIMessage, AIMessageChunk, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatResult, ChatGenerationChunk } from '@langchain/core/outputs';
import axios from 'axios';

import { BaseChatModelParams } from '@langchain/core/language_models/chat_models';

interface ReasoningChatModelParams extends BaseChatModelParams {
  apiKey: string;
  baseURL: string;
  modelName: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  streamDelay?: number; // Add this parameter for controlling stream delay
}

export class ReasoningChatModel extends BaseChatModel<BaseChatModelCallOptions & { stream?: boolean }> {
  private apiKey: string;
  private baseURL: string;
  private modelName: string;
  private temperature: number;
  private maxTokens: number;
  private topP: number;
  private frequencyPenalty: number;
  private presencePenalty: number;
  private streamDelay: number;

  constructor(params: ReasoningChatModelParams) {
    super(params);
    this.apiKey = params.apiKey;
    this.baseURL = params.baseURL;
    this.modelName = params.modelName;
    this.temperature = params.temperature ?? 0.7;
    this.maxTokens = params.max_tokens ?? 8192;
    this.topP = params.top_p ?? 1;
    this.frequencyPenalty = params.frequency_penalty ?? 0;
    this.presencePenalty = params.presence_penalty ?? 0;
    this.streamDelay = params.streamDelay ?? 0; // Default to no delay
  }

  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const formattedMessages = messages.map(msg => ({
      role: this.getRole(msg),
      content: msg.content.toString(),
    }));
    const response = await this.callAPI(formattedMessages, options.stream);

    if (options.stream) {
      return this.processStreamingResponse(response, messages, options, runManager);
    } else {
      const choice = response.data.choices[0];
      let content = choice.message.content || '';
      if (choice.message.reasoning_content) {
        content = `<think>\n${choice.message.reasoning_content}\n</think>\n\n${content}`;
      }

      // Report usage stats if available
      if (response.data.usage && runManager) {
        runManager.handleLLMEnd({
          generations: [],
          llmOutput: {
            tokenUsage: {
              completionTokens: response.data.usage.completion_tokens,
              promptTokens: response.data.usage.prompt_tokens,
              totalTokens: response.data.usage.total_tokens
            }
          }
        });
      }
      return {
        generations: [
          {
            text: content,
            message: new AIMessage(content),
          },
        ],
      };
    }
  }

  private getRole(msg: BaseMessage): string {
    if (msg instanceof SystemMessage) return 'system';
    if (msg instanceof HumanMessage) return 'user';
    if (msg instanceof AIMessage) return 'assistant';
    return 'user'; // Default to user
  }

  private async callAPI(messages: Array<{ role: string; content: string }>, streaming?: boolean) {
    return axios.post(
      `${this.baseURL}/chat/completions`,
      {
        messages,
        model: this.modelName,
        stream: streaming,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        top_p: this.topP,
        frequency_penalty: this.frequencyPenalty,
        presence_penalty: this.presencePenalty,
        response_format: { type: 'text' },
        ...(streaming && {
          stream_options: {
            include_usage: true
          }
        })
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        responseType: streaming ? 'text' : 'json',
      }
    );
  }

  public async *_streamResponseChunks(messages: BaseMessage[], options: this['ParsedCallOptions'], runManager?: CallbackManagerForLLMRun) {
    const response = await this.callAPI(messages.map(msg => ({
      role: this.getRole(msg),
      content: msg.content.toString(),
    })), true);

    let thinkState = -1; // -1: not started, 0: thinking, 1: answered
    let currentContent = '';

    // Split the response into lines
    const lines = response.data.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6);
      if (jsonStr === '[DONE]') break;

      try {
        const chunk = JSON.parse(jsonStr);
        const delta = chunk.choices[0].delta;

        // Handle usage stats in final chunk
        if (chunk.usage && !chunk.choices?.length) {
          runManager?.handleLLMEnd?.({
            generations: [],
            llmOutput: {
              tokenUsage: {
                completionTokens: chunk.usage.completion_tokens,
                promptTokens: chunk.usage.prompt_tokens,
                totalTokens: chunk.usage.total_tokens
              }
            }
          });
          continue;
        }

        // Handle reasoning content
        if (delta.reasoning_content) {
          if (thinkState === -1) {
            thinkState = 0;
            const startTag = '<think>\n';
            currentContent += startTag;
            runManager?.handleLLMNewToken(startTag);
            const chunk = new ChatGenerationChunk({
              text: startTag,
              message: new AIMessageChunk(startTag),
              generationInfo: {}
            });
            
            // Add configurable delay before yielding the chunk
            if (this.streamDelay > 0) {
              await new Promise(resolve => setTimeout(resolve, this.streamDelay));
            }
            
            yield chunk;
          }
          currentContent += delta.reasoning_content;
          runManager?.handleLLMNewToken(delta.reasoning_content);
          const chunk = new ChatGenerationChunk({
            text: delta.reasoning_content,
            message: new AIMessageChunk(delta.reasoning_content),
            generationInfo: {}
          });
          
          // Add configurable delay before yielding the chunk
          if (this.streamDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.streamDelay));
          }
          
          yield chunk;
        }

        // Handle regular content
        if (delta.content) {
          if (thinkState === 0) {
            thinkState = 1;
            const endTag = '\n</think>\n\n';
            currentContent += endTag;
            runManager?.handleLLMNewToken(endTag);
            const chunk = new ChatGenerationChunk({
              text: endTag,
              message: new AIMessageChunk(endTag),
              generationInfo: {}
            });
            
            // Add configurable delay before yielding the chunk
            if (this.streamDelay > 0) {
              await new Promise(resolve => setTimeout(resolve, this.streamDelay));
            }
            
            yield chunk;
          }
          currentContent += delta.content;
          runManager?.handleLLMNewToken(delta.content);
          const chunk = new ChatGenerationChunk({
            text: delta.content,
            message: new AIMessageChunk(delta.content),
            generationInfo: {}
          });
          
          // Add configurable delay before yielding the chunk
          if (this.streamDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.streamDelay));
          }
          
          yield chunk;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to parse chunk';
        console.error(`Streaming error: ${errorMessage}`);
        if (error instanceof Error && error.message.includes('DeepSeek API Error')) {
          throw error;
        }
      }
    }

    // Handle any unclosed think block
    if (thinkState === 0) {
      const endTag = '\n</think>\n\n';
      currentContent += endTag;
      runManager?.handleLLMNewToken(endTag);
      const chunk = new ChatGenerationChunk({
        text: endTag,
        message: new AIMessageChunk(endTag),
        generationInfo: {}
      });
      
      // Add configurable delay before yielding the chunk
      if (this.streamDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.streamDelay));
      }
      
      yield chunk;
    }
  }

  private async processStreamingResponse(response: any, messages: BaseMessage[], options: this['ParsedCallOptions'], runManager?: CallbackManagerForLLMRun): Promise<ChatResult> {
    let accumulatedContent = '';
    for await (const chunk of this._streamResponseChunks(messages, options, runManager)) {
      accumulatedContent += chunk.message.content;
    }
    return {
      generations: [
        {
          text: accumulatedContent,
          message: new AIMessage(accumulatedContent),
        },
      ],
    };
  }

  _llmType(): string {
    return 'reasoning';
  }
}
