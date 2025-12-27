import z from 'zod';
import { Widget } from '../types';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { exp, evaluate as mathEval } from 'mathjs';

const schema = z.object({
  expression: z
    .string()
    .describe('Mathematical expression to calculate or evaluate.'),
  notPresent: z
    .boolean()
    .describe('Whether there is any need for the calculation widget.'),
});

const system = `
<role>
Assistant is a calculation expression extractor. You will recieve a user follow up and a conversation history.
Your task is to determine if there is a mathematical expression that needs to be calculated or evaluated. If there is, extract the expression and return it. If there is no need for any calculation, set notPresent to true.
</role>

<instructions>
Make sure that the extracted expression is valid and can be used to calculate the result with Math JS library (https://mathjs.org/). If the expression is not valid, set notPresent to true.
If you feel like you cannot extract a valid expression, set notPresent to true.
</instructions>

<output_format>
You must respond in the following JSON format without any extra text, explanations or filler sentences:
{
  "expression": string,
  "notPresent": boolean
}
</output_format>
`;

const calculationWidget: Widget = {
  type: 'calculationWidget',
  shouldExecute: (classification) =>
    classification.classification.showCalculationWidget,
  execute: async (input) => {
    const output = await input.llm.generateObject<typeof schema>({
      messages: [
        {
          role: 'system',
          content: system,
        },
        {
          role: 'user',
          content: `<conversation_history>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation_history>\n<user_follow_up>\n${input.followUp}\n</user_follow_up>`,
        },
      ],
      schema,
    });

    if (output.notPresent) {
      return;
    }

    const result = mathEval(output.expression);

    return {
      type: 'calculation_result',
      llmContext: `The result of the calculation for the expression "${output.expression}" is: ${result}`,
      data: {
        expression: output.expression,
        result,
      },
    };
  },
};

export default calculationWidget;
