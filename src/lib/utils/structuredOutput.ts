import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGroq } from '@langchain/groq';
import { z } from 'zod';

interface StructuredOutputOptions {
  name?: string;
  includeRaw?: boolean;
}

/**
 * Configures structured output for the given LLM with appropriate method based on the model type.
 * For Groq models, uses 'jsonMode' method. For other models, omits the method property.
 */
export function withStructuredOutput<T extends z.ZodType>(
  llm: BaseChatModel,
  schema: T,
  options: StructuredOutputOptions = {},
) {
  const isGroqModel = llm instanceof ChatGroq;

  if (isGroqModel) {
    return llm.withStructuredOutput(schema, {
      name: options.name,
      method: 'jsonMode' as const,
    });
  } else {
    return llm.withStructuredOutput(schema, {
      name: options.name,
    });
  }
}
