import { fuzzyMatchPages } from './fuzzy';
import type { AuthorizedPage } from './types';

/**
 * Parsing of "@Notion" mentions in a chat message.
 *
 * Only the "@Notion" marker is stripped from the content; the page-name
 * hint that follows it stays in the text so the user's question is never
 * swallowed. The hint is bounded by sentence punctuation, another
 * mention, or a newline, and is resolved through Fuzzy Page Search (the
 * picker is the precise path; the agent re-confirms unresolved names).
 */

const MENTION_TOKEN = /@Notion\b/gi;
// Punctuation, another mention, or end of line bounds the name hint.
const NAME_BOUNDARY = /[，。！？；、,.!?;@\n]/;

export function hasNotionMention(content: string): boolean {
  // Fresh, non-global regex: global .test() is stateful and would keep
  // a stale lastIndex between calls.
  return /@Notion\b/i.test(content);
}

export function parseNotionMentions(content: string): {
  cleaned: string;
  names: string[];
} {
  const names: string[] = [];

  const cleaned = content
    .replace(MENTION_TOKEN, (match, offset: number, full: string) => {
      const rest = full.slice(offset + match.length);
      const boundaryIndex = rest.search(NAME_BOUNDARY);
      const hint = (
        boundaryIndex === -1 ? rest : rest.slice(0, boundaryIndex)
      ).trim();

      if (hint) names.push(hint);

      return ''; // Strip the marker only; the hint text stays in the message.
    })
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { cleaned, names };
}

export function resolveMention(
  pages: AuthorizedPage[],
  name: string,
): AuthorizedPage | null {
  const [best] = fuzzyMatchPages(pages, name);
  return best ?? null;
}
