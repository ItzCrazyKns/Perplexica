import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { removeThinkingBlocksFromMessages } from '@/lib/utils/contentUtils';
import { invokeStructuredOutputWithUsage } from '@/lib/utils/structuredOutputWithUsage';
import { setTemperature } from '@/lib/utils/modelUtils';
import z from 'zod';

export type ClarificationEvaluatorOutput = {
  needsClarification: boolean;
  questions?: string[];
  reasoning?: string;
};

// Schema for structured output
const ClarificationEvaluatorSchema = z.object({
  needsClarification: z
    .boolean()
    .describe(
      'Whether the query needs clarification before proceeding with deep research',
    ),
  questions: z
    .array(z.string())
    .optional()
    .nullable()
    .describe(
      'Specific clarifying questions to ask the user (2-4 questions max). Only provided if needsClarification is true.',
    ),
  reasoning: z
    .string()
    .optional()
    .nullable()
    .describe(
      'Brief explanation of why clarification is needed or why the query is sufficient',
    ),
});

const clarificationEvaluatorPrompt = `You are a research query evaluator. Your job is to determine if a user's query is sufficiently detailed and specific for deep research, or if it requires clarification.

# Evaluation Criteria

## Queries that NEED clarification:
1. **Overly broad or vague topics** with no specific angle
   - Examples: "Tell me about AI", "What about climate change?", "History of computers"
2. **Ambiguous terms** that could have multiple interpretations
   - Examples: "What's the best approach?" (approach to what?), "Recent developments" (in what field? how recent?)
3. **Missing critical context** for actionable research
   - Examples: "Compare the options" (which options?), "Is it worth it?" (what specifically?)
4. **Undefined scope or timeframe** when it matters
   - Examples: "Market trends" (which market? what timeframe?), "Research on X" (what aspect of X?)
5. **Personal or subjective preferences not specified**
   - Examples: "Best laptop" (for what use case? budget?), "Good restaurants" (where? what cuisine?)

## Queries that are SUFFICIENT (do NOT need clarification):
1. **Specific, well-defined questions** with clear scope
   - Examples: "What are the main causes of the 2008 financial crisis?", "How does CRISPR gene editing work?"
2. **Questions with adequate context** from chat history
   - If prior messages provide the necessary context for understanding the current query
3. **Exploratory research** with reasonable boundaries
   - Examples: "What are recent breakthroughs in quantum computing in 2024?", "Compare TypeScript vs JavaScript for web development"
4. **Questions where the lack of specificity is intentional**
   - Examples: "What are different approaches to machine learning?", "Overview of Renaissance art"

# Guidelines

- **Be conservative**: Only request clarification when absolutely necessary. Err on the side of letting research proceed.
- **Consider chat history**: If previous messages provide context, the current query may be sufficient.
- **Focus on actionable gaps**: Only ask questions that would genuinely improve research quality and focus.
- **Keep questions specific and helpful**: Ask 1-4 targeted questions maximum. Questions should guide the user to provide useful specifics.
- **Avoid over-questioning**: Don't ask for clarification on queries that can be reasonably researched as stated.

# Response Format

Respond with JSON containing:
- \`needsClarification\`: boolean indicating if clarification is needed
- \`questions\`: array of 2-4 specific clarifying questions (only if needsClarification is true)
- \`reasoning\`: brief explanation (1-2 sentences) of your decision`;

export async function clarificationEvaluatorTool(
  llm: BaseChatModel,
  query: string,
  signal: AbortSignal,
  history: BaseMessage[] = [],
  onUsage?: (usageData: any) => void,
): Promise<ClarificationEvaluatorOutput> {
  const messages = [
    new SystemMessage(clarificationEvaluatorPrompt),
    ...removeThinkingBlocksFromMessages(history).slice(-4), // Include last 2 exchanges for context
    new HumanMessage(`Evaluate this query: "${query}"`),
  ];

  try {
    setTemperature(llm, 0.1); // Low temperature for consistent evaluation

    const response = await invokeStructuredOutputWithUsage(
      llm,
      ClarificationEvaluatorSchema,
      messages,
      signal,
      onUsage,
      { name: 'clarification_evaluator' },
    );

    console.log(
      `clarificationEvaluatorTool response for "${query}":`,
      response,
    );
    return response as ClarificationEvaluatorOutput;
  } finally {
    setTemperature(llm);
  }
}
