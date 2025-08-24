import { Document } from '@langchain/core/documents';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { z } from 'zod';
import { getWebContent } from './documents';
import { formatDateForLLM } from '../utils';
import { setTemperature } from './modelUtils';
import { withStructuredOutput } from './structuredOutput';
import { getLangfuseCallbacks } from '@/lib/tracing/langfuse';

export type ExtractFactsOutput = {
  title?: string;
  facts: string[];
  quotes: string[];
  notRelevantReason?: string;
};

const ExtractionSchema = z.object({
  relevant: z
    .boolean()
    .describe(
      'Whether the content contains information that helps answer the user query (partial is acceptable).',
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
          'One short, atomic fact (≤25 words) stated in your own words. No quotes, no markdown bullets.',
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
});

/**
 * Extract short facts and direct quotes from a URL, targeted to a specific query.
 * - Single pass regardless of content size; no short-content or html modes
 * - Uses structured output for compact, reliable parsing
 * - Returns facts/quotes only when content is relevant to the query
 */
export async function extractFactsAndQuotes(
  url: string,
  query: string,
  llm: BaseChatModel,
  systemInstructions: string,
  signal: AbortSignal,
  onUsage?: (usage: any) => void,
): Promise<ExtractFactsOutput | null> {
  setTemperature(llm, 0);
  try {
    const content = await getWebContent(url, true);
    if (!content) {
      return { facts: [], quotes: [], notRelevantReason: 'No content at URL' };
    }

    const baseSystem = systemInstructions
      ? `${systemInstructions}\n\n`
      : '';

    const structured = withStructuredOutput(llm, ExtractionSchema, {
      name: 'extract_facts_and_quotes',
    });
    const body = content.pageContent || content.metadata.html || '';
    if (!body || body.trim().length === 0) {
      return {
        title: (content.metadata?.title as string) || undefined,
        facts: [],
        quotes: [],
        notRelevantReason: 'No extractable content',
      };
    }

    const prompt = `${baseSystem}You extract short, atomic facts and direct quotes with provenance.

# Task
Given the user's query and webpage content, decide if the content is relevant. If relevant, return facts and quotes that best help answer the query. If not relevant, return empty arrays.

# Rules
- Facts: ≤25 words, no markdown bullets, no quotes, one idea per item
- Quotes: short direct quotes (≤200 chars) copied verbatim from the content
- Only include items that directly support the query

Today's date is ${formatDateForLLM(new Date())}

User query:
${query}

Web content:
${body}`;

    const res = await structured.invoke(prompt, {
      signal,
      ...getLangfuseCallbacks(),
    });

    if (onUsage) {
      try {
        onUsage({ kind: 'extract_facts_and_quotes', url });
      } catch {}
    }

    if (!res || res.relevant === false) {
      return {
        title: (content.metadata?.title as string) || undefined,
        facts: [],
        quotes: [],
        notRelevantReason: res?.reason || 'Content not relevant to query',
      };
    }

    // Sanitize/trim facts to ~25 words and quotes to max 200 chars
    const trimWords = (s: string, maxWords = 25) =>
      (s || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, maxWords)
        .join(' ')
        .trim();

    const facts = (res.facts || [])
      .map((f: string) => trimWords(f, 25))
      .filter(Boolean)
      .slice(0, 12);
    const quotes = (res.quotes || [])
      .map((q: string) => (q || '').slice(0, 200))
      .filter(Boolean)
      .slice(0, 6);

    return {
      title: (content.metadata?.title as string) || undefined,
      facts,
      quotes,
    };
  } catch (error) {
    console.error('extractFactsAndQuotes error:', error);
    return {
      facts: [],
      quotes: [],
      notRelevantReason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  } finally {
    setTemperature(llm);
  }
}
