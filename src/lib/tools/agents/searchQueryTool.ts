import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { withStructuredOutput } from '@/lib/utils/structuredOutput';
import { removeThinkingBlocksFromMessages } from '@/lib/utils/contentUtils';
import { formatDateForLLM } from '@/lib/utils';
import { z } from 'zod';

export type QueryOutput = {
  searchQuery: string;
};

const QuerySchema = z.object({
  searchQuery: z
    .string()
    .describe(
      'Concise web search query for the user question; use "not_needed" if search is not required.',
    ),
});

/**
 * Generate a concise initial web search query using structured output.
 * - History is passed with thinking blocks removed
 * - Returns { searchQuery } where value can be 'not_needed'
 */
export async function searchQueryTool(
  llm: BaseChatModel,
  query: string,
  signal: AbortSignal,
  history: BaseMessage[] = [],
  onUsage?: (usageData: any) => void,
): Promise<QueryOutput> {
  const messages = [
    ...removeThinkingBlocksFromMessages(history),
    new SystemMessage(
      `You generate a single concise web search query for the user's question based on the conversation context.\n\nRules:\n- Return a brief, specific query suitable for web search\n- Include entities, dates, or site:example.com if appropriate\n- If a web search is not needed, set searchQuery to "not_needed"\n- Current date is ${formatDateForLLM(new Date())}`,
    ),
    new HumanMessage(`${query}`),
  ];

  try {
    const structured = withStructuredOutput(llm, QuerySchema, {
      name: 'generate_initial_search_query',
    });
    const response: any = await structured.invoke(messages, { signal });
    if (onUsage && response?.usage) {
      onUsage(response.usage);
    }
    const candidate = (response?.searchQuery || '').trim();
    return { searchQuery: candidate };
  } catch (e) {
    console.error('searchQueryTool error:', e);
    return { searchQuery: query };
  }
}

export default searchQueryTool;
