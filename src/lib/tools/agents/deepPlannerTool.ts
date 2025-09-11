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
  history: BaseMessage[] = [],
  onUsage?: (usageData: any) => void,
): Promise<PlannerOutput> {
  const messages = [
    ...removeThinkingBlocksFromMessages(history),
    new SystemMessage(plannerPrompt),
    new HumanMessage(`${query}`),
  ];
  try {
    const structuredllm = withStructuredOutput(llm, PlannerSchema, {});
    const response = await structuredllm.invoke(messages);

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
