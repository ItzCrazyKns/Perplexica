import z from 'zod';
import { ResearchAction } from '../../types';

const schema = z.object({
  plan: z
    .string()
    .describe(
      'A concise natural-language plan in one short paragraph. Open with a short intent phrase (e.g., "Okay, the user wants to...", "Searching for...", "Looking into...") and lay out the steps you will take.',
    ),
});

const planAction: ResearchAction<typeof schema> = {
  name: '___plan',
  description:
    'Use this FIRST on every turn to state your plan in natural language before any other action. Keep it short, action-focused, and tailored to the current query.',
  schema: schema,
  enabled: (_) => true,
  execute: async (input, _) => {
    return {
      type: 'reasoning',
      reasoning: input.plan,
    };
  },
};

export default planAction;
