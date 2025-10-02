import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { formatDateForLLM } from '../utils';
import { getWebContent } from './documents';
import { setTemperature } from './modelUtils';
import { invokeStructuredOutputWithUsage } from './structuredOutputWithUsage';

export type ExtractFactsOutput = {
  facts: string[];
  quotes: string[];
  longContent: string[];
  notRelevantReason?: string;
};

const ExtractionSchema = z.object({
  relevant: z
    .boolean()
    .describe(
      'Whether the content contains information that helps answer the user query (partial answers are acceptable).',
    ),
  reason: z
    .string()
    .describe(
      "Brief explanation of why it's relevant or not. Keep under 20 words.",
    ),
  facts: z
    .array(
      z
        .string()
        .describe(
          'One short, atomic fact (≤50 words) stated in your own words. No quotes, no markdown bullets.',
        ),
    )
    .max(12)
    .describe('Up to 12 terse facts that directly support the query.'),
  quotes: z
    .array(
      z
        .string()
        .describe(
          'A direct quote from the content, 200 chars max. Include quotation marks in output.',
        ),
    )
    .max(6)
    .describe('Up to 6 short, high-signal quotes.'),
  longContent: z
    .array(z.string())
    .optional()
    .nullable()
    .describe(
      'Optional list of long content sections that contain relevant info that must be kept intact. For example, technical specs, legal text, code snippets, table data, etc. These should be preserved in full. Use only when necessary if the quotes and facts are insufficient.',
    ),
});

/**
 * Extract short facts and direct quotes from content, targeted to a specific query.
 * - Single pass regardless of content size; no short-content or html modes
 * - Uses structured output for compact, reliable parsing
 * - Returns facts/quotes only when content is relevant to the query
 */
export async function extractContentFactsAndQuotes(
  content: string,
  query: string,
  llm: BaseChatModel,
  signal: AbortSignal,
  onUsage?: (usage: any) => void,
): Promise<ExtractFactsOutput | null> {
  setTemperature(llm, 0);
  try {
    if (!content || content.trim().length === 0) {
      return {
        facts: [],
        quotes: [],
        longContent: [],
        notRelevantReason: 'No extractable content',
      };
    }

    const prompt = `You extract short, atomic facts and direct quotes with provenance.

# Task
Given the user's query and webpage content, decide if the content is relevant. If relevant, return facts and quotes that best help answer the query. If not relevant, return empty arrays.

# Rules
- Facts: ≤50 words, no markdown bullets, no quotes, one idea per item
- Quotes: short direct quotes (≤200 chars) copied verbatim from the content
- Long content: if the content contains complex, detailed, or technical information that cannot be easily summarized in short facts or quotes, include these sections in full to preserve their meaning and context
- Only include items that directly support the query

# Response format
Respond in JSON format with these fields:
- relevant: boolean, true if content helps answer the query (partial answers are ok)
- reason: string, brief explanation of relevance (≤20 words)
- facts: array of short factual statements in your own words (max 12 items, 25 words max per item)
- quotes: array of direct quotes from the content (max 6 items, 200 chars max per item, include quotation marks)
- longContent: Optional list of long content sections that contain relevant info that must be kept intact. For example, technical specs, legal text, code snippets, table data, etc. These should be preserved in full. Use only when necessary if the quotes and facts are insufficient.

# Context

Today's date is ${formatDateForLLM(new Date())}

User query:
${query}

Web content:
${content}`;

    const res = await invokeStructuredOutputWithUsage(
      llm,
      ExtractionSchema,
      [new SystemMessage(prompt)],
      signal,
      onUsage,
      { name: 'extract_facts_and_quotes' },
    );

    if (!res || res.relevant === false) {
      return {
        facts: [],
        quotes: [],
        longContent: [],
        notRelevantReason: res?.reason || 'Content not relevant to query',
      };
    }

    const facts = (res.facts || []).filter(Boolean).slice(0, 12);

    const quotes = (res.quotes || []).filter(Boolean).slice(0, 6);

    return {
      facts,
      quotes,
      longContent: res.longContent || [],
    };
  } catch (error) {
    console.error('extractFactsAndQuotes error:', error);
    return {
      facts: [],
      quotes: [],
      longContent: [],
      notRelevantReason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  } finally {
    setTemperature(llm);
  }
}

/**
 * Extract short facts and direct quotes from a URL, targeted to a specific query.
 * - Single pass regardless of content size; no short-content or html modes
 * - Uses structured output for compact, reliable parsing
 * - Returns facts/quotes only when content is relevant to the query
 */
export async function extractWebFactsAndQuotes(
  url: string,
  query: string,
  llm: BaseChatModel,
  signal: AbortSignal,
  onUsage?: (usage: any) => void,
): Promise<ExtractFactsOutput | null> {
  const content = await getWebContent(url, 50000, false, signal, false, true);

  const body = content?.pageContent || content?.metadata.html || '';

  return await extractContentFactsAndQuotes(body, query, llm, signal, onUsage);
}
