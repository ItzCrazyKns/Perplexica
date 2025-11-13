import { BaseMessageLike } from "@langchain/core/messages";

export const videoSearchPrompt = `
You will be given a conversation below and a follow up question. You need to rephrase the follow-up question so it is a standalone question that can be used by the LLM to search Youtube for videos.
You need to make sure the rephrased question agrees with the conversation and is relevant to the conversation.
Output only the rephrased query wrapped in an XML <query> element. Do not include any explanation or additional text.
`;

export const videoSearchFewShots: BaseMessageLike[] = [
    [
        'user',
        '<conversation>\n</conversation>\n<follow_up>\nHow does a car work?\n</follow_up>',
    ],
    ['assistant', '<query>How does a car work?</query>'],
    [
        'user',
        '<conversation>\n</conversation>\n<follow_up>\nWhat is the theory of relativity?\n</follow_up>',
    ],
    ['assistant', '<query>Theory of relativity</query>'],
    [
        'user',
        '<conversation>\n</conversation>\n<follow_up>\nHow does an AC work?\n</follow_up>',
    ],
    ['assistant', '<query>AC working</query>'],
]