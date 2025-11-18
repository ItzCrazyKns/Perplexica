import OpenAI from 'openai';
import BaseLLM from '../../base/llm';
import { zodTextFormat, zodResponseFormat } from 'openai/helpers/zod';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '../../types';
import { parse } from 'partial-json';

type OpenAIConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
  options?: GenerateOptions;
};

class OpenAILLM extends BaseLLM<OpenAIConfig> {
  openAIClient: OpenAI;

  constructor(protected config: OpenAIConfig) {
    super(config);

    this.openAIClient = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL || 'https://api.openai.com/v1',
    });
  }

  withOptions(options: GenerateOptions) {
    this.config.options = {
      ...this.config.options,
      ...options,
    };

    return this;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    this.withOptions(input.options || {});

    const response = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      messages: input.messages,
      temperature: this.config.options?.temperature || 1.0,
      top_p: this.config.options?.topP,
      max_completion_tokens: this.config.options?.maxTokens,
      stop: this.config.options?.stopSequences,
      frequency_penalty: this.config.options?.frequencyPenalty,
      presence_penalty: this.config.options?.presencePenalty,
    });

    if (response.choices && response.choices.length > 0) {
      return {
        content: response.choices[0].message.content!,
        additionalInfo: {
          finishReason: response.choices[0].finish_reason,
        },
      };
    }

    throw new Error('No response from OpenAI');
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    this.withOptions(input.options || {});

    const stream = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      messages: input.messages,
      temperature: this.config.options?.temperature || 1.0,
      top_p: this.config.options?.topP,
      max_completion_tokens: this.config.options?.maxTokens,
      stop: this.config.options?.stopSequences,
      frequency_penalty: this.config.options?.frequencyPenalty,
      presence_penalty: this.config.options?.presencePenalty,
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices.length > 0) {
        yield {
          contentChunk: chunk.choices[0].delta.content || '',
          done: chunk.choices[0].finish_reason !== null,
          additionalInfo: {
            finishReason: chunk.choices[0].finish_reason,
          },
        };
      }
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    this.withOptions(input.options || {});

    const response = await this.openAIClient.chat.completions.parse({
      messages: input.messages,
      model: this.config.model,
      temperature: this.config.options?.temperature || 1.0,
      top_p: this.config.options?.topP,
      max_completion_tokens: this.config.options?.maxTokens,
      stop: this.config.options?.stopSequences,
      frequency_penalty: this.config.options?.frequencyPenalty,
      presence_penalty: this.config.options?.presencePenalty,
      response_format: zodResponseFormat(input.schema, 'object'),
    });

    if (response.choices && response.choices.length > 0) {
      try {
        return input.schema.parse(response.choices[0].message.parsed) as T;
      } catch (err) {
        throw new Error(`Error parsing response from OpenAI: ${err}`);
      }
    }

    throw new Error('No response from OpenAI');
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    let recievedObj: string = '';

    this.withOptions(input.options || {});

    const stream = this.openAIClient.responses.stream({
      model: this.config.model,
      input: input.messages,
      temperature: this.config.options?.temperature || 1.0,
      top_p: this.config.options?.topP,
      max_completion_tokens: this.config.options?.maxTokens,
      stop: this.config.options?.stopSequences,
      frequency_penalty: this.config.options?.frequencyPenalty,
      presence_penalty: this.config.options?.presencePenalty,
      text: {
        format: zodTextFormat(input.schema, 'object'),
      },
    });

    for await (const chunk of stream) {
      if (chunk.type === 'response.output_text.delta' && chunk.delta) {
        recievedObj += chunk.delta;

        try {
          yield parse(recievedObj) as T;
        } catch (err) {
          console.log('Error parsing partial object from OpenAI:', err);
          yield {} as T;
        }
      } else if (chunk.type === 'response.output_text.done' && chunk.text) {
        try {
          yield parse(chunk.text) as T;
        } catch (err) {
          throw new Error(`Error parsing response from OpenAI: ${err}`);
        }
      }
    }
  }
}

export default OpenAILLM;
