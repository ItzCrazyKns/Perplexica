import {
  GenerateObjectInput,
  GenerateObjectOutput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamObjectOutput,
  StreamTextOutput,
} from '../types';

abstract class BaseLLM<CONFIG> {
  constructor(protected config: CONFIG) {}
  abstract withOptions(options: GenerateOptions): this;
  abstract generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
  abstract streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput>;
  abstract generateObject<T>(
    input: GenerateObjectInput,
  ): Promise<GenerateObjectOutput<T>>;
  abstract streamObject<T>(
    input: GenerateObjectInput,
  ): AsyncGenerator<StreamObjectOutput<T>>;
}

export default BaseLLM;
