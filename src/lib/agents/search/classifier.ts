import z from 'zod';
import { ClassifierInput } from './types';
import { classifierPrompt } from '@/lib/prompts/search/classifier';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';

const schema = z.object({
  classification: z.object({
    skipSearch: z
      .boolean()
      .describe('Indicates whether to skip the search step.'),
    personalSearch: z
      .boolean()
      .describe('Indicates whether to perform a personal search.'),
    academicSearch: z
      .boolean()
      .describe('Indicates whether to perform an academic search.'),
    discussionSearch: z
      .boolean()
      .describe('Indicates whether to perform a discussion search.'),
    showWeatherWidget: z
      .boolean()
      .describe('Indicates whether to show the weather widget.'),
    showStockWidget: z
      .boolean()
      .describe('Indicates whether to show the stock widget.'),
    showCalculationWidget: z
      .boolean()
      .describe('Indicates whether to show the calculation widget.'),
  }),
  standaloneFollowUp: z
    .string()
    .describe(
      "A self-contained, context-independent reformulation of the user's question.",
    ),
});

const safeDefault = (query: string): z.infer<typeof schema> => ({
  classification: {
    skipSearch: false,
    personalSearch: false,
    academicSearch: false,
    discussionSearch: false,
    showWeatherWidget: false,
    showStockWidget: false,
    showCalculationWidget: false,
  },
  standaloneFollowUp: query,
});

export const classify = async (input: ClassifierInput) => {
  let fullText = '';

  const stream = input.llm.streamText({
    messages: [
      {
        role: 'system',
        content: classifierPrompt,
      },
      {
        role: 'user',
        content: `<conversation_history>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation_history>\n<user_query>\n${input.query}\n</user_query>`,
      },
    ],
  });

  for await (const chunk of stream) {
    fullText += chunk.contentChunk;
  }

  try {
    let parsed: unknown;

    // Try direct parse first (model followed instructions exactly)
    try {
      parsed = JSON.parse(fullText.trim());
    } catch {
      // Model may have wrapped JSON in markdown or added extra text — extract it
      const match = fullText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON object found in classifier response');
      parsed = JSON.parse(match[0]);
    }

    return schema.parse(parsed);
  } catch (err) {
    console.warn('[classify] Failed to parse response, falling back to defaults. Raw response:', fullText, 'Error:', err);
    return safeDefault(input.query);
  }
};
