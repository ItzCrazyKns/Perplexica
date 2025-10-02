import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { withStructuredOutput } from './structuredOutput';
import { RunnableConfig } from '@langchain/core/runnables';
import { StructuredOutputMethodOptions } from '@langchain/core/language_models/base';

/**
 * Wrapper around withStructuredOutput that properly handles token usage tracking via callbacks.
 *
 * When using structured outputs in LangChain, usage metadata is not available on the response
 * object directly. Instead, it must be captured through the handleLLMEnd callback.
 *
 * @param llm - The chat model to use
 * @param schema - Zod schema defining the structured output format
 * @param messages - Array of messages to send to the model
 * @param signal - AbortSignal for cancellation
 * @param onUsage - Optional callback to receive usage metadata
 * @param options - Optional configuration (name for tracing, includeRaw)
 * @returns Promise resolving to the parsed structured output
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   answer: z.string(),
 *   confidence: z.number(),
 * });
 *
 * const result = await invokeStructuredOutputWithUsage(
 *   llm,
 *   schema,
 *   messages,
 *   signal,
 *   (usage) => console.log('Tokens used:', usage),
 *   { name: 'my_tool' }
 * );
 * ```
 */
export async function invokeStructuredOutputWithUsage<T extends z.ZodType>(
  llm: BaseChatModel,
  schema: T,
  messages: BaseMessage[],
  signal: AbortSignal,
  onUsage?: (usageData: any) => void,
  options?: StructuredOutputMethodOptions<false>,
): Promise<z.infer<T>> {
  const structuredLlm = withStructuredOutput(llm, schema, options);

  const response = await structuredLlm.invoke(messages, {
    signal,
    callbacks: onUsage
      ? [
          {
            handleLLMEnd: async (output, _runId, _parentRunId) => {
              // Token usage is available in llmOutput.tokenUsage or llmOutput.estimatedTokenUsage
              if (
                output.llmOutput?.estimatedTokenUsage ||
                output.llmOutput?.tokenUsage
              ) {
                onUsage(
                  output.llmOutput.estimatedTokenUsage ||
                    output.llmOutput.tokenUsage,
                );
              }
            },
          },
        ]
      : undefined,
  });

  return response as z.infer<T>;
}
