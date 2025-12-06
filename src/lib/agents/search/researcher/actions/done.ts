import z from 'zod';
import { ResearchAction } from '../../types';

const doneAction: ResearchAction<any> = {
  name: 'done',
  description:
    'Only call this after ___plan AND after any other needed tool calls when you truly have enough to answer. Do not call if information is still missing.',
  enabled: (_) => true,
  schema: z.object({}),
  execute: async (params, additionalConfig) => {
    return {
      type: 'done',
    };
  },
};

export default doneAction;
