import { ToolCall } from '@/lib/models/types';

/*
 * Local models sometimes narrate an attempted call as text instead of
 * using the native tool-call channel ('Action: web_search ["a"]',
 * 'web_search(query="a")', or raw template XML). When a researcher
 * iteration yields zero native calls, this parses those attempts so
 * the run degrades gracefully instead of returning empty context.
 * Synthesized arguments still pass the action schema validation in
 * the registry before execution.
 */

const ARRAY_ARG_TOOLS: Record<string, string> = {
  web_search: 'queries',
  academic_search: 'queries',
  social_search: 'queries',
  scrape_url: 'urls',
  uploads_search: 'queries',
};

const firstJsonArray = (text: string): string[] | null => {
  const start = text.indexOf('[');
  if (start === -1) return null;

  for (let end = start + 1; end <= Math.min(text.length, start + 2000); end++) {
    if (text[end - 1] !== ']') continue;
    try {
      const parsed = JSON.parse(text.slice(start, end));
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        return parsed;
      }
    } catch {
      /* keep scanning for the matching bracket */
    }
  }

  return null;
};

/* 'name("a", "b")' or 'name(query="a")' call-style arguments. */
const parenArgs = (text: string): string[] | null => {
  const m = text.match(/^\s*\(([^)]{1,1000})\)/);
  if (!m) return null;

  const strings = m[1].match(/"((?:[^"\\]|\\.)*)"/g);
  if (!strings || strings.length === 0) return null;

  return strings.map((s) => JSON.parse(s));
};

export const parseTextActions = (
  text: string,
  availableTools: string[],
): ToolCall[] => {
  const calls: ToolCall[] = [];
  const names = availableTools.filter((n) => n in ARRAY_ARG_TOOLS);

  const hits: { name: string; at: number }[] = [];
  for (const name of names) {
    let from = 0;
    while (true) {
      const at = text.indexOf(name, from);
      if (at === -1) break;
      hits.push({ name, at });
      from = at + name.length;
    }
  }
  hits.sort((a, b) => a.at - b.at);

  for (const hit of hits) {
    const after = text.slice(hit.at + hit.name.length, hit.at + hit.name.length + 2000);
    const args = firstJsonArray(after.slice(0, 600)) ?? parenArgs(after);

    if (!args || args.length === 0) continue;

    calls.push({
      id: `text-fallback-${calls.length}`,
      name: hit.name,
      arguments: { [ARRAY_ARG_TOOLS[hit.name]]: args },
    });
  }

  /* Dedupe repeated narrations of the same call. */
  const seen = new Set<string>();
  return calls.filter((c) => {
    const key = c.name + JSON.stringify(c.arguments);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
