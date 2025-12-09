import EventEmitter from 'events';
import { randomUUID } from 'node:crypto';
import { MetaSearchAgentType } from './metaSearchAgent';
import { searchSearxng } from '../searxng';
import { Lane, NewsSource, TriangulatedNewsResult } from '@/types/newsTriangulate';

type FetchOptions = {
  engines?: string[];
  pageno?: number;
  language?: string;
  limit?: number;
  perDomainCap?: number;
};

type NormalizedResult = NewsSource;

const DEFAULT_FETCH_OPTS: Required<Pick<FetchOptions, 'limit' | 'perDomainCap'>> =
  {
    limit: 40,
    perDomainCap: 2,
  };

const DEFAULT_BALANCE_PER_LANE = 6;

const DOMAIN_LANE_MAP: Record<string, Lane> = {
  'apnews.com': 'CENTER',
  'reuters.com': 'CENTER',
  'bloomberg.com': 'CENTER',
  'npr.org': 'CENTER',
  'nytimes.com': 'LEFT',
  'washingtonpost.com': 'LEFT',
  'theguardian.com': 'LEFT',
  'foxnews.com': 'RIGHT',
  'nypost.com': 'RIGHT',
  'dailymail.co.uk': 'RIGHT',
};

const getDomain = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export const fetchNormalizedNewsResults = async (
  query: string,
  opts?: FetchOptions,
): Promise<NormalizedResult[]> => {
  const limit = opts?.limit ?? DEFAULT_FETCH_OPTS.limit;
  const perDomainCap = opts?.perDomainCap ?? DEFAULT_FETCH_OPTS.perDomainCap;

  const res = await searchSearxng(query, {
    engines: opts?.engines,
    pageno: opts?.pageno,
    language: opts?.language ?? 'en',
  });

  const domainCounts = new Map<string, number>();
  const normalized: NormalizedResult[] = [];

  for (const result of res.results) {
    if (!result.url || !result.title) continue;

    const domain = getDomain(result.url);
    if (!domain) continue;

    const current = domainCounts.get(domain) ?? 0;
    if (current >= perDomainCap) continue;

    domainCounts.set(domain, current + 1);

    normalized.push({
      id: randomUUID(),
      url: result.url,
      title: result.title,
      snippet: result.content ?? '',
      domain,
      sourceName: domain,
      timestamp: (result as any).publishedDate ?? undefined,
    });

    if (normalized.length >= limit) break;
  }

  return normalized;
};

const tagLaneForDomain = (domain: string): Lane => {
  const cleanDomain = domain.toLowerCase();
  if (DOMAIN_LANE_MAP[cleanDomain]) return DOMAIN_LANE_MAP[cleanDomain];

  if (cleanDomain.endsWith('.gov') || cleanDomain.endsWith('.edu')) {
    return 'CENTER';
  }

  return 'UNKNOWN';
};

const withLaneTags = (sources: NewsSource[]): NewsSource[] =>
  sources.map((s) => ({
    ...s,
    lane: s.lane ?? tagLaneForDomain(s.domain),
  }));

const parseTimestamp = (ts?: string) => {
  if (!ts) return undefined;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export const selectBalancedNewsSources = (
  sources: NewsSource[],
  perLane: number = DEFAULT_BALANCE_PER_LANE,
): NewsSource[] => {
  const grouped: Record<Lane, NewsSource[]> = {
    LEFT: [],
    RIGHT: [],
    CENTER: [],
    UNKNOWN: [],
  };

  sources.forEach((s) => {
    grouped[s.lane ?? 'UNKNOWN'].push(s);
  });

  const sortByRecency = (a: NewsSource, b: NewsSource) => {
    const aDate = parseTimestamp(a.timestamp)?.getTime() ?? 0;
    const bDate = parseTimestamp(b.timestamp)?.getTime() ?? 0;
    if (aDate === bDate) return a.title.localeCompare(b.title);
    return bDate - aDate;
  };

  (Object.keys(grouped) as Lane[]).forEach((lane) =>
    grouped[lane].sort(sortByRecency),
  );

  const balanced: NewsSource[] = [];

  (['LEFT', 'RIGHT', 'CENTER', 'UNKNOWN'] as Lane[]).forEach((lane) => {
    balanced.push(...grouped[lane].slice(0, perLane));
  });

  return balanced;
};

const buildPlaceholderResult = (sources: NewsSource[]): TriangulatedNewsResult => {
  const laneCounts = sources.reduce<Record<Lane, number>>((acc, source) => {
    const lane = source.lane ?? 'UNKNOWN';
    acc[lane] = (acc[lane] ?? 0) + 1;
    return acc;
  }, {} as Record<Lane, number>);

  return {
    summary:
      'Triangulated news placeholder: fetching diversified sources and preparing claim graph scaffolding.',
    sharedFacts: [],
    conflicts: [],
    uniqueAngles: [],
    lanes: Object.entries(laneCounts).map(([lane, count]) => ({
      lane: lane as Lane,
      count,
    })),
    sources,
  };
};

export class NewsTriangulationAgent implements MetaSearchAgentType {
  async searchAndAnswer(
    message: string,
    _history: any[],
    _llm: any,
    _embeddings: any,
    _optimizationMode: any,
    _fileIds: string[],
    _systemInstructions: string,
  ) {
    const emitter = new EventEmitter();

    queueMicrotask(async () => {
      try {
        const sources = await fetchNormalizedNewsResults(message, {
          engines: ['bing news'],
          pageno: 1,
          language: 'en',
          limit: 40,
          perDomainCap: 2,
        });

        const tagged = withLaneTags(sources);
        const balanced = selectBalancedNewsSources(tagged);

        const placeholder = buildPlaceholderResult(balanced);

        emitter.emit(
          'data',
          JSON.stringify({ type: 'response', data: placeholder.summary }),
        );

        emitter.emit(
          'data',
          JSON.stringify({ type: 'sources', data: placeholder.sources }),
        );

        emitter.emit('end');
      } catch (error) {
        emitter.emit('error', error);
      }
    });

    return emitter;
  }
}

