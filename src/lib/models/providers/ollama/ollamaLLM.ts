import z from 'zod';
import BaseLLM from '../../base/llm';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '../../types';
import { Ollama } from 'ollama';
import { parse } from 'partial-json';

type OllamaConfig = {
  baseURL: string;
  model: string;
  options?: GenerateOptions;
};

const reasoningModels = [
  'gpt-oss',
  'deepseek-r1',
  'qwen3',
  'deepseek-v3.1',
  'magistral',
];

class OllamaLLM extends BaseLLM<OllamaConfig> {
  ollamaClient: Ollama;

  constructor(protected config: OllamaConfig) {
    super(config);

    this.ollamaClient = new Ollama({
      host: this.config.baseURL || 'http://localhost:11434',
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

    const res = await this.ollamaClient.chat({
      model: this.config.model,
      messages: input.messages,
      options: {
        top_p: this.config.options?.topP,
        temperature: this.config.options?.temperature,
        num_predict: this.config.options?.maxTokens,
        num_ctx: 32000,
        frequency_penalty: this.config.options?.frequencyPenalty,
        presence_penalty: this.config.options?.presencePenalty,
        stop: this.config.options?.stopSequences,
      },
    });

    return {
      content: res.message.content,
      additionalInfo: {
        reasoning: res.message.thinking,
      },
    };
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    this.withOptions(input.options || {});

    const stream = await this.ollamaClient.chat({
      model: this.config.model,
      messages: input.messages,
      stream: true,
      options: {
        top_p: this.config.options?.topP,
        temperature: this.config.options?.temperature,
        num_ctx: 32000,
        num_predict: this.config.options?.maxTokens,
        frequency_penalty: this.config.options?.frequencyPenalty,
        presence_penalty: this.config.options?.presencePenalty,
        stop: this.config.options?.stopSequences,
      },
    });

    for await (const chunk of stream) {
      yield {
        contentChunk: chunk.message.content,
        done: chunk.done,
        additionalInfo: {
          reasoning: chunk.message.thinking,
        },
      };
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    this.withOptions(input.options || {});

    const response = await this.ollamaClient.chat({
      model: this.config.model,
      messages: input.messages,
      format: z.toJSONSchema(input.schema),
      ...(reasoningModels.find((m) => this.config.model.includes(m))
        ? { think: false }
        : {}),
      options: {
        top_p: this.config.options?.topP,
        temperature: 0.7,
        num_predict: this.config.options?.maxTokens,
        frequency_penalty: this.config.options?.frequencyPenalty,
        presence_penalty: this.config.options?.presencePenalty,
        stop: this.config.options?.stopSequences,
      },
    });

    try {
      return input.schema.parse(JSON.parse(response.message.content)) as T;
    } catch (err) {
      throw new Error(`Error parsing response from Ollama: ${err}`);
    }
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    let recievedObj: string = '';

    this.withOptions(input.options || {});

    const stream = await this.ollamaClient.chat({
      model: this.config.model,
      messages: input.messages,
      format: z.toJSONSchema(input.schema),
      stream: true,
      ...(reasoningModels.find((m) => this.config.model.includes(m))
        ? { think: false }
        : {}),
      options: {
        top_p: this.config.options?.topP,
        temperature: 0.7,
        num_predict: this.config.options?.maxTokens,
        frequency_penalty: this.config.options?.frequencyPenalty,
        presence_penalty: this.config.options?.presencePenalty,
        stop: this.config.options?.stopSequences,
      },
    });

    for await (const chunk of stream) {
      recievedObj += chunk.message.content;

      try {
        yield parse(recievedObj) as T;
      } catch (err) {
        console.log('Error parsing partial object from Ollama:', err);
        yield {} as T;
      }
    }
  }
}

export default OllamaLLM;
