import { ChatTurnMessage } from '@/lib/types';

export const videoSearchPrompt = `
You will be given a conversation below and a follow up question. You need to rephrase the follow-up question so it is a standalone question that can be used by the LLM to search Youtube for videos.
You need to make sure the rephrased question agrees with the conversation and is relevant to the conversation.
Make sure to make the querey standalone and not something very broad, use context from the answers in the conversation to make it specific so user can get best video search results.
Output only the rephrased query in query key JSON format. Do not include any explanation or additional text.
`;

export const videoSearchFewShots: ChatTurnMessage[] = [
  {
    role: 'user',
    content:
      '<conversation>\n</conversation>\n<follow_up>\nHow does a car work?\n</follow_up>',
  },
  { role: 'assistant', content: '{"query":"How does a car work?"}' },
  {
    role: 'user',
    content:
      '<conversation>\n</conversation>\n<follow_up>\nWhat is the theory of relativity?\n</follow_up>',
  },
  { role: 'assistant', content: '{"query":"Theory of relativity"}' },
  {
    role: 'user',
    content:
      '<conversation>\n</conversation>\n<follow_up>\nHow does an AC work?\n</follow_up>',
  },
  { role: 'assistant', content: '{"query":"AC working"}' },
];
