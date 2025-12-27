import { ChatTurnMessage } from '@/lib/types';

export const imageSearchPrompt = `
You will be given a conversation below and a follow up question. You need to rephrase the follow-up question so it is a standalone question that can be used by the LLM to search the web for images.
You need to make sure the rephrased question agrees with the conversation and is relevant to the conversation.
Make sure to make the querey standalone and not something very broad, use context from the answers in the conversation to make it specific so user can get best image search results.
Output only the rephrased query in query key JSON format. Do not include any explanation or additional text.
`;

export const imageSearchFewShots: ChatTurnMessage[] = [
  {
    role: 'user',
    content:
      '<conversation>\n</conversation>\n<follow_up>\nWhat is a cat?\n</follow_up>',
  },
  { role: 'assistant', content: '{"query":"A cat"}' },

  {
    role: 'user',
    content:
      '<conversation>\n</conversation>\n<follow_up>\nWhat is a car? How does it work?\n</follow_up>',
  },
  { role: 'assistant', content: '{"query":"Car working"}' },
  {
    role: 'user',
    content:
      '<conversation>\n</conversation>\n<follow_up>\nHow does an AC work?\n</follow_up>',
  },
  { role: 'assistant', content: '{"query":"AC working"}' },
];
