import z from 'zod';
import {
  GenerateObjectInput,
  GenerateTextInput,
  StreamTextOutput,
} from '../types';

abstract class BaseLLM<CONFIG> {
  constructor(protected config: CONFIG) {}
  abstract streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput>;
  abstract generateObject<T>(input: GenerateObjectInput): Promise<z.infer<T>>;
}

export default BaseLLM;
