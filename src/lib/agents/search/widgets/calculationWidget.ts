import z from 'zod';
import { Widget } from '../types';
import { evaluate as mathEval } from 'mathjs';

const schema = z.object({
  type: z.literal('calculation'),
  expression: z
    .string()
    .describe(
      "A valid mathematical expression to be evaluated (e.g., '2 + 2', '3 * (4 + 5)').",
    ),
});

const calculationWidget: Widget<typeof schema> = {
  name: 'calculation',
  description: `Performs mathematical calculations and evaluates mathematical expressions. Supports arithmetic operations, algebraic equations, functions, and complex mathematical computations.

**What it provides:**
- Evaluates mathematical expressions and returns computed results
- Handles basic arithmetic (+, -, *, /)
- Supports functions (sqrt, sin, cos, log, etc.)
- Can process complex expressions with parentheses and order of operations

**When to use:**
- User asks to calculate, compute, or evaluate a mathematical expression
- Questions like "what is X", "calculate Y", "how much is Z" where X/Y/Z are math expressions
- Any request involving numbers and mathematical operations

**Example call:**
{
  "type": "calculation",
  "expression": "25% of 480"
}

{
  "type": "calculation", 
  "expression": "sqrt(144) + 5 * 2"
}

**Important:** The expression must be valid mathematical syntax that can be evaluated by mathjs. Format percentages as "0.25 * 480" or "25% of 480". Do not include currency symbols, units, or non-mathematical text in the expression.`,
  schema: schema,
  execute: async (params, _) => {
    try {
      const result = mathEval(params.expression);

      return {
        type: 'calculation_result',
        llmContext: `The result of the expression "${params.expression}" is ${result}.`,
        data: {
          expression: params.expression,
          result: result,
        },
      };
    } catch (error) {
      return {
        type: 'calculation_result',
        llmContext: 'Failed to evaluate mathematical expression.',
        data: {
          expression: params.expression,
          result: `Error evaluating expression: ${error}`,
        },
      };
    }
  },
};

export default calculationWidget;
