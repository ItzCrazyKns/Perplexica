import type { Cluster } from './clusterCompressTool';
import type { EvidenceItem } from './evidenceStoreTool';

export type Outline = {
  sections: Array<{ title: string; bullets: string[] }>;
  confidenceBySection?: Record<string, number>;
};

export async function deepSynthesizerTool(
  query: string,
  subquestions: string[],
  clusters: Cluster[],
  evidence: EvidenceItem[] = [],
): Promise<Outline> {
  // Build sources set for later consolidation and inline markers
  const allUrls = new Set<string>();
  clusters.forEach((c) => c.docUrls.forEach((u) => allUrls.add(u)));
  evidence.forEach((e) => e.sources.forEach((s) => allUrls.add(s.url)));

  function cite(url: string, title?: string) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      const t = title && title.length > 0 ? title : host;
      return `[${t}/${host}]`;
    } catch {
      return title ? `[${title}]` : '[source]';
    }
  }

  function multiCite(urls: string[], titles: (string | undefined)[]): string {
    const unique: Array<{ url: string; title?: string }> = [];
    const seen = new Set<string>();
    urls.forEach((u, i) => {
      if (!u || seen.has(u)) return;
      seen.add(u);
      unique.push({ url: u, title: titles[i] });
    });
    // include up to 3 markers
    return unique
      .slice(0, 3)
      .map((s) => cite(s.url, s.title))
      .join(' ');
  }

  const confidenceBySection: Record<string, number> = {};

  // Executive Summary: pull top cluster summaries and overall stance
  const rankedByCoverage = [...clusters]
    .map((c) => ({
      c,
      score: (c.coverageScore ?? 0) + (c.noveltyScore ?? 0) * 0.15,
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
  const execClusters = rankedByCoverage.slice(0, 2);
  const execDocs = execClusters.flatMap((c) => c.docUrls.slice(0, 2));
  const execBullets: string[] = [];
  // Use cluster summaries and append citations
  for (const c of execClusters) {
    const urls = c.docUrls.slice(0, 2);
    execBullets.push(
      `${c.summary || 'Key theme identified'} ${multiCite(
        urls,
        urls.map(() => undefined),
      )}`.trim(),
    );
  }
  if (execBullets.length === 0)
    execBullets.push(
      'No strong consensus; results limited by available sources.',
    );
  const execDiversity = new Set(
    execDocs
      .map((u) => {
        try {
          return new URL(u).hostname.replace(/^www\./, '');
        } catch {
          return '';
        }
      })
      .filter(Boolean),
  ).size;
  const execConf = Math.min(1, 0.4 + Math.min(1, execDiversity / 6) * 0.6);
  confidenceBySection['Executive Summary'] = Number(execConf.toFixed(2));

  const mainSections = subquestions.map((sq) => {
    // Selection policy: pick top 2 clusters for this subquestion, then up to 2 doc URLs per cluster
    const rankedClusters = [...clusters]
      .map((c) => ({
        c,
        score:
          (c.subquestionScores?.[sq] ?? 0) +
          (c.coverageScore ?? 0) * 0.2 +
          (c.noveltyScore ?? 0) * 0.1,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((x) => x.c);
    const selectedDocUrls = rankedClusters.flatMap((c) =>
      c.docUrls.slice(0, 2),
    );
    const evPool = evidence.filter((e) =>
      e.sources.some((s) => selectedDocUrls.includes(s.url)),
    );
    const ev = evPool.slice(0, 4);
    const citedBullets = ev.map((e) => {
      const srcs = e.sources.filter((s) => selectedDocUrls.includes(s.url));
      const urls = srcs.map((s) => s.url);
      const titles = srcs.map((s) => s.title);
      const markers = urls.length > 0 ? multiCite(urls, titles) : '[source]';
      return `${e.claim} ${markers}`.trim();
    });
    // Ensure at least one source-backed statement
    if (citedBullets.length === 0 && selectedDocUrls.length > 0) {
      const u = selectedDocUrls[0];
      citedBullets.push(`Evidence gathered from ${cite(u)}`);
    }
    // Simple confidence: combine cluster coverage and number of unique sources referenced
    const matchedCluster = clusters.reduce(
      (best, c) => {
        const score = c.subquestionScores?.[sq] ?? 0;
        return score > (best.score ?? -Infinity) ? { cluster: c, score } : best;
      },
      { cluster: undefined as Cluster | undefined, score: -Infinity } as {
        cluster: Cluster | undefined;
        score: number;
      },
    );
    const cov = matchedCluster.cluster?.coverageBySubquestion?.[sq] ?? 0;
    const diversity = new Set(
      evidence
        .flatMap((e) => e.sources.map((s) => s.url))
        .map((u) => {
          try {
            return new URL(u).hostname.replace(/^www\./, '');
          } catch {
            return '';
          }
        })
        .filter(Boolean),
    ).size;
    const diversityNorm = Math.min(1, diversity / 8);
    const conf = Math.max(0.15, Math.min(1, 0.5 * cov + 0.5 * diversityNorm));
    confidenceBySection[sq] = Number(conf.toFixed(2));
    return {
      title: sq,
      bullets: [
        `Overview (selected ${rankedClusters.length} clusters, ${selectedDocUrls.length} docs)`,
        ...citedBullets,
      ],
    };
  });

  // Limitations & Open Questions: surface low-coverage subquestions
  const lowCoverage: string[] = [];
  for (const sq of subquestions) {
    const best = clusters.reduce((acc, c) => {
      const v = c.coverageBySubquestion?.[sq] ?? 0;
      return v > acc ? v : acc;
    }, 0);
    if (best < 0.4)
      lowCoverage.push(`${sq} (coverage ~${(best * 100).toFixed(0)}%)`);
  }
  const limitationsBullets = [
    ...(lowCoverage.length
      ? [`Areas with limited evidence: ${lowCoverage.slice(0, 5).join('; ')}`]
      : ['No major coverage gaps detected.']),
    'Some sources may be outdated or secondary; verify critical claims in primary sources where possible.',
  ];

  const sections = [
    { title: 'Executive Summary', bullets: execBullets },
    ...mainSections,
    { title: 'Limitations & Open Questions', bullets: limitationsBullets },
  ];

  return { sections, confidenceBySection };
}
