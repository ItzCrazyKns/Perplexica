import z from 'zod';
import { ClassifierInput, ClassifierOutput } from '../types';
import { WidgetRegistry } from '../widgets';
import { IntentRegistry } from './intents';
import { getClassifierPrompt } from '@/lib/prompts/search/classifier';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';

class Classifier {
  async classify(input: ClassifierInput): Promise<ClassifierOutput> {
    const availableIntents = IntentRegistry.getAvailableIntents({
      sources: input.enabledSources,
    });

    const availableWidgets = WidgetRegistry.getAll();

    const classificationSchema = z.object({
      skipSearch: z
        .boolean()
        .describe(
          'Set to true to SKIP search. Skip ONLY when: (1) widgets alone fully answer the query (e.g., weather, stocks, calculator), (2) simple greetings or writing tasks (NOT questions). Set to false for ANY question or information request.',
        ),
      standaloneFollowUp: z
        .string()
        .describe(
          "A self-contained, context-independent reformulation of the user's question. Must include all necessary context from chat history, replace pronouns with specific nouns, and be clear enough to answer without seeing the conversation. Keep the same complexity as the original question.",
        ),
      intents: z
        .array(z.enum(availableIntents.map((i) => i.name)))
        .describe(
          "The intent(s) that best describe how to fulfill the user's query. Can include multiple intents (e.g., ['web_search', 'widget_response'] for 'weather in NYC and recent news'). Always include at least one intent when applicable.",
        ),
      widgets: z
        .array(z.union(availableWidgets.map((w) => w.schema)))
        .describe(
          'Widgets that can display structured data to answer (fully or partially) the query. Include all applicable widgets regardless of skipSearch value.',
        ),
    });

    const classifierPrompt = getClassifierPrompt({
      intentDesc: IntentRegistry.getDescriptions({
        sources: input.enabledSources,
      }),
      widgetDesc: WidgetRegistry.getDescriptions(),
    });

    const res = await input.llm.generateObject<
      z.infer<typeof classificationSchema>
    >({
      messages: [
        {
          role: 'system',
          content: classifierPrompt,
        },
        {
          role: 'user',
          content: `<conversation>${formatChatHistoryAsString(input.chatHistory)}</conversation>\n\n<query>${input.query}</query>`,
        },
      ],
      schema: classificationSchema,
    });

    res.widgets = res.widgets.map((widgetConfig) => {
      return {
        type: widgetConfig.type,
        params: widgetConfig,
      };
    });

    return res as ClassifierOutput;
  }
}

export default Classifier;
