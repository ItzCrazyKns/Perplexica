import z from 'zod';
import { ResearchAction } from '../../types';

const doneAction: ResearchAction<any> = {
  name: 'done',
  description:
    "Indicates that the research process is complete and no further actions are needed. Use this action when you have gathered sufficient information to answer the user's query.",
  enabled: (_) => true,
  schema: z.object({
    type: z.literal('done'),
  }),
  execute: async (params, additionalConfig) => {
    return {
      type: 'done',
    };
  },
};

export default doneAction;
