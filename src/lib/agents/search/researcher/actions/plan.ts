import z from 'zod';
import { ResearchAction } from '../../types';

const schema = z.object({
  plan: z
    .string()
    .describe(
      'A concise natural-language plan in one short paragraph. Open with a short intent phrase (e.g., "Okay, the user wants to...", "Searching for...", "Looking into...") and lay out the steps you will take.',
    ),
});

const actionDescription = `
Use this tool to narrate a short natural-language plan that the user sees while research runs. Keep it brief, action-focused, and tailored to the current query, without naming any tools.
It is optional: if narrating gets in the way, proceed directly with information-gathering tools. Never let this tool block real research.
`;

const planAction: ResearchAction<typeof schema> = {
  name: '__reasoning_preamble',
  schema: schema,
  getToolDescription: () =>
    'Optionally narrate a short natural-language plan the user sees while research runs. Never let it block information-gathering calls.',
  getDescription: () => actionDescription,
  enabled: (config) => config.mode !== 'speed',
  execute: async (input, _) => {
    return {
      type: 'reasoning',
      reasoning: input.plan,
    };
  },
};

export default planAction;
