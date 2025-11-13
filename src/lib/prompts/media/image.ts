import { BaseMessageLike } from "@langchain/core/messages";

export const imageSearchPrompt = `
You will be given a conversation below and a follow up question. You need to rephrase the follow-up question so it is a standalone question that can be used by the LLM to search the web for images.
You need to make sure the rephrased question agrees with the conversation and is relevant to the conversation.
Output only the rephrased query wrapped in an XML <query> element. Do not include any explanation or additional text.
`;

export const imageSearchFewShots: BaseMessageLike[] = [
    [
        'user',
        '<conversation>\n</conversation>\n<follow_up>\nWhat is a cat?\n</follow_up>',
    ],
    ['assistant', '<query>A cat</query>'],

    [
        'user',
        '<conversation>\n</conversation>\n<follow_up>\nWhat is a car? How does it work?\n</follow_up>',
    ],
    ['assistant', '<query>Car working</query>'],
    [
        'user',
        '<conversation>\n</conversation>\n<follow_up>\nHow does an AC work?\n</follow_up>',
    ],
    ['assistant', '<query>AC working</query>']
]