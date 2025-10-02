import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { plannerPrompt } from '@/lib/prompts/deepResearch/planner';
import { removeThinkingBlocksFromMessages } from '@/lib/utils/contentUtils';
import { invokeStructuredOutputWithUsage } from '@/lib/utils/structuredOutputWithUsage';
import z from 'zod';
import { setTemperature } from '@/lib/utils/modelUtils';

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
  plannerGuidance: string,
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
    ...(plannerGuidance && plannerGuidance.length > 0
      ? [new HumanMessage(plannerGuidance)]
      : []),
    new HumanMessage(`${query}`),
  ];
  try {
    setTemperature(llm, 0.2);

    const response = await invokeStructuredOutputWithUsage(
      llm,
      PlannerSchema,
      messages,
      signal,
      onUsage,
      { name: 'deep_planner' },
    );

    console.log(`deepPlannerTool response for ${query}:`, response);
    return response as PlannerOutput;
  } finally {
    setTemperature(llm);
  }
}
