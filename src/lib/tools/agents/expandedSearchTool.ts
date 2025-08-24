import { searchSearxng } from '@/lib/searxng';

export type Candidate = { title: string; url: string; snippet?: string };

export async function expandedSearchTool(
  subquestions: string[],
  opts?: {
    maxPerSubq?: number;
    maxTotal?: number;
    maxPerDomain?: number;
  },
): Promise<Candidate[]> {
  const maxPerSubq = opts?.maxPerSubq ?? 8;
  const maxTotal = opts?.maxTotal ?? 30;
  const maxPerDomain = opts?.maxPerDomain ?? 3;

  const seen = new Set<string>();
  const out: Candidate[] = [];
  const perDomain: Record<string, number> = {};

  for (const sq of subquestions) {
    if (out.length >= maxTotal) break;
    const local: Array<Candidate & { __score?: number }> = [];
    const terms = sq.toLowerCase().split(/\s+/).filter(Boolean);

    if (out.length >= maxTotal || local.length >= maxPerSubq) break;
    try {
      const { results } = await searchSearxng(sq);
      for (const r of results) {
        const url = r.url;
        if (!url || seen.has(url)) continue;
        let host = '';
        try {
          host = new URL(url).hostname.replace(/^www\./, '');
        } catch {}
        const count = perDomain[host] || 0;
        if (host && count >= maxPerDomain) continue;
        seen.add(url);
        if (host) perDomain[host] = (perDomain[host] || 0) + 1;
        const text = `${r.title || ''} ${r.content || ''}`.toLowerCase();
        let score = 0;
        for (const t of terms) {
          if (t.length < 3) continue;
          const re = new RegExp(
            `\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            'g',
          );
          const matches = text.match(re);
          score += matches ? matches.length : 0;
        }
        // Small boost for shorter domains list to encourage diversity
        const diversityBoost = host
          ? Math.max(0, 3 - (perDomain[host] || 0)) * 0.1
          : 0;
        local.push({
          title: r.title || url,
          url,
          snippet: r.content,
          __score: score + diversityBoost,
        });
        if (local.length >= maxPerSubq) break;
        if (out.length + local.length >= maxTotal) break;
      }
    } catch (e) {
      // Log and continue to next query
      console.warn('expandedSearchTool: SearXNG query failed', e);
    }

    // Sort by score desc and take top for this subquestion
    local.sort((a, b) => (b.__score || 0) - (a.__score || 0));
    out.push(...local.map(({ __score, ...rest }) => rest));
  }

  return out.slice(0, maxTotal);
}
