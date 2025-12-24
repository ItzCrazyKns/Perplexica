import z from 'zod';
import { ResearchAction } from '../../types';

const actionDescription = `
Use this action ONLY when you have completed all necessary research and are ready to provide a final answer to the user. This indicates that you have gathered sufficient information from previous steps and are concluding the research process.
YOU MUST CALL THIS ACTION TO SIGNAL COMPLETION; DO NOT OUTPUT FINAL ANSWERS DIRECTLY TO THE USER.
IT WILL BE AUTOMATICALLY TRIGGERED IF MAXIMUM ITERATIONS ARE REACHED SO IF YOU'RE LOW ON ITERATIONS, DON'T CALL IT AND INSTEAD FOCUS ON GATHERING ESSENTIAL INFO FIRST.
`;

const doneAction: ResearchAction<any> = {
  name: 'done',
  schema: z.object({}),
  getToolDescription: () =>
    'Only call this after __reasoning_preamble AND after any other needed tool calls when you truly have enough to answer. Do not call if information is still missing.',
  getDescription: () => actionDescription,
  enabled: (_) => true,
  execute: async (params, additionalConfig) => {
    return {
      type: 'done',
    };
  },
};

export default doneAction;
