import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { plannerPrompt } from '@/lib/prompts/deepResearch/planner';
import { removeThinkingBlocksFromMessages } from '@/lib/utils/contentUtils';
import { withStructuredOutput } from '@/lib/utils/structuredOutput';
import z from 'zod';

export type PlannerOutput = {
  subquestions: string[];
  criteria?: string[];
  notes?: string[];
};

// Schema for structured output
const PlannerSchema = z.object({
  subquestions: z
    .array(z.string())
    .describe('Array of subquestions generated from the original query'),
  criteria: z
    .array(z.string())
    .optional()
    .nullable()
    .describe('Array of criteria for evaluating the subquestions'),
  notes: z
    .array(z.string())
    .optional()
    .nullable()
    .describe('Array of notes or comments about the subquestions'),
});

export async function deepPlannerTool(
  llm: BaseChatModel,
  query: string,
  signal: AbortSignal,
  history: BaseMessage[] = [],
  onUsage?: (usageData: any) => void,
  options?: { webContext?: string; date?: string },
): Promise<PlannerOutput> {
  const messages = [
    ...removeThinkingBlocksFromMessages(history),
    new SystemMessage(plannerPrompt),
    // Provide fresh web context (if available) to bias planning toward current events
    ...(options?.webContext
      ? [
          new HumanMessage(
            `Recent web scan (${options?.date || 'today'}) — titles/snippets:\n${options.webContext}\n\nUse this transient context to ensure subquestions reflect current events and terminology.`,
          ),
        ]
      : []),
    new HumanMessage(`${query}`),
  ];
  try {
    const structuredllm = withStructuredOutput(llm, PlannerSchema, {});
    const response = await structuredllm.invoke(messages, { signal });

    if (onUsage && response.usage) {
      onUsage(response.usage);
    }
    console.log(`deepPlannerTool response for ${query}:`, response);
    return response;
  } catch (e) {
    console.error('deepPlannerTool error:', e);
  }
  return { subquestions: [] };
}
