import type { Candidate } from './expandedSearchTool';
import { extractFactsAndQuotes } from '@/lib/utils/extractWebFacts';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export type ExtractedDoc = {
  url: string;
  title?: string;
  facts: string[];
  quotes: string[];
};

// Very compact system instructions for extraction to minimize tokens
const extractorSystem = `You extract short, atomic facts and direct quotes with provenance. Keep facts terse (≤25 words).`;

export async function readerExtractorTool(
  candidates: Candidate[],
  query: string,
  llm: BaseChatModel,
  signal: AbortSignal,
  onUsage?: (usageData: any) => void,
): Promise<ExtractedDoc[]> {
  const results: ExtractedDoc[] = [];
  // Cap how many URLs we fetch to control budget
  const MAX_DOCS = Math.min(12, candidates.length);
  const MAX_FACTS_PER_DOC = 8;
  const MAX_QUOTES_PER_DOC = 3;

  for (const c of candidates.slice(0, MAX_DOCS)) {
    if (signal.aborted) break;
    try {
      const res = await extractFactsAndQuotes(
        c.url,
        query,
        llm,
        extractorSystem,
        signal,
        onUsage,
      );
      if (!res || (res.facts.length === 0 && res.quotes.length === 0)) continue;
      results.push({
        url: c.url,
        title: res.title || c.title,
        facts: res.facts.slice(0, MAX_FACTS_PER_DOC),
        quotes: res.quotes.slice(0, MAX_QUOTES_PER_DOC),
      });
    } catch (e) {
      console.warn('readerExtractorTool: failed for url', c.url, e);
    }
  }

  console.log(`readerExtractorTool: subquery results for ${query}`, results);
  return results;
}