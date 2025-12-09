import EventEmitter from 'events';
import { randomUUID } from 'node:crypto';
import { MetaSearchAgentType } from './metaSearchAgent';
import { searchSearxng } from '../searxng';
import { NewsSource, TriangulatedNewsResult } from '@/types/newsTriangulate';

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

const buildPlaceholderResult = (sources: NewsSource[]): TriangulatedNewsResult => {
  return {
    summary:
      'Triangulated news placeholder: fetching diversified sources and preparing claim graph scaffolding.',
    sharedFacts: [],
    conflicts: [],
    uniqueAngles: [],
    lanes: [],
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

        const placeholder = buildPlaceholderResult(sources);

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

