import z from 'zod';
import { ClassifierInput } from './types';
import { classifierPrompt } from '@/lib/prompts/search/classifier';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { escapePromptText } from '@/lib/utils/escapePromptText';

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

export const classify = async (input: ClassifierInput) => {
  const notionPagesDesc = (input.notionPages ?? [])
    .map(
      (page) =>
        `<page type="${escapePromptText(page.type)}">${escapePromptText(page.title)}</page>`,
    )
    .join('\n');

  const output = await input.llm.generateObject<typeof schema>({
    messages: [
      {
        role: 'system',
        content: classifierPrompt,
      },
      {
        role: 'user',
        content: `<conversation_history>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation_history>\n<user_query>\n${input.query}\n</user_query>\n<enabled_sources>\n${input.enabledSources.join(', ')}\n</enabled_sources>${
          notionPagesDesc
            ? `\n<selected_notion_pages>\n${notionPagesDesc}\n</selected_notion_pages>`
            : ''
        }`,
      },
    ],
    schema,
  });

  // Deterministic guarantee, not prompt-dependent: when the user has
  // explicitly attached Notion pages to this conversation, research must
  // run and the pages must be treated as personal context. Without this,
  // the model can classify meta-questions ("can you see this page?",
  // "what do you have selected?") as skipSearch, which silently drops the
  // attached pages — the "UI selection does nothing" symptom.
  const hasAttachedPages = (input.notionPages?.length ?? 0) > 0;
  if (hasAttachedPages) {
    return {
      ...output,
      classification: {
        ...output.classification,
        personalSearch: true,
        skipSearch: false,
      },
    };
  }

  return output;
};
