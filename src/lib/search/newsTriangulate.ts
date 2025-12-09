import EventEmitter from 'events';
import { randomUUID } from 'node:crypto';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import { MetaSearchAgentType } from './metaSearchAgent';
import { searchSearxng } from '../searxng';
import computeSimilarity from '../utils/computeSimilarity';
import {
  Lane,
  NewsSource,
  NewsClaim,
  ClaimCluster,
  TriangulatedNewsResult,
} from '@/types/newsTriangulate';

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

/**
 * Extracts structured claims from a news source using the LLM.
 * Returns an array of claims with metadata (who, when, where, type).
 */
const extractClaimsFromSource = async (
  source: NewsSource,
  llm: BaseChatModel,
): Promise<NewsClaim[]> => {
  const prompt = `You are a claim extraction system. Extract factual claims from this news article.

Title: ${source.title}
Content: ${source.snippet || 'No content available'}

Return a JSON array of claims. Each claim should have:
- "text": the claim statement (1-2 sentences)
- "who": who is making or involved in the claim (if mentioned)
- "when": when did this happen (if mentioned)
- "where": location (if mentioned)
- "type": one of "fact", "opinion", "quote", or "other"
- "confidence": "high" if directly stated, "medium" if implied, "low" if uncertain

Return ONLY valid JSON array. Example:
[{"text":"The president signed the bill","who":"president","when":"today","where":"White House","type":"fact","confidence":"high"}]

If no clear claims can be extracted, return an empty array: []`;

  try {
    const response = await llm.invoke(prompt);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      text: string;
      who?: string;
      when?: string;
      where?: string;
      type?: string;
      confidence?: string;
    }>;

    return parsed.map((claim) => ({
      id: randomUUID(),
      sourceId: source.id,
      lane: source.lane,
      text: claim.text,
      who: claim.who,
      when: claim.when,
      where: claim.where,
      claimType: (['fact', 'opinion', 'quote', 'other'].includes(claim.type || '')
        ? claim.type
        : 'other') as NewsClaim['claimType'],
      confidence: (['low', 'medium', 'high'].includes(claim.confidence || '')
        ? claim.confidence
        : 'medium') as NewsClaim['confidence'],
    }));
  } catch (err) {
    console.error(`Claim extraction failed for source ${source.id}:`, err);
    return [];
  }
};

/**
 * Embeds all claims and clusters them by similarity.
 * Returns clusters with supporting/disagreeing claims and lane coverage.
 */
const buildClaimClusters = async (
  claims: NewsClaim[],
  embeddings: Embeddings,
  similarityThreshold = 0.75,
): Promise<ClaimCluster[]> => {
  if (claims.length === 0) return [];

  // Embed all claim texts
  const claimTexts = claims.map((c) => c.text);
  const vectors = await embeddings.embedDocuments(claimTexts);

  // Track which claims have been clustered
  const clustered = new Set<number>();
  const clusters: ClaimCluster[] = [];

  for (let i = 0; i < claims.length; i++) {
    if (clustered.has(i)) continue;

    const cluster: NewsClaim[] = [claims[i]];
    clustered.add(i);

    // Find similar claims
    for (let j = i + 1; j < claims.length; j++) {
      if (clustered.has(j)) continue;

      const similarity = computeSimilarity(vectors[i], vectors[j]);
      if (similarity >= similarityThreshold) {
        cluster.push(claims[j]);
        clustered.add(j);
      }
    }

    // Build cluster metadata
    const lanes = [...new Set(cluster.map((c) => c.lane).filter(Boolean))] as Lane[];
    const uniqueSources = new Set(cluster.map((c) => c.sourceId));

    // Determine agreement level based on source diversity
    let agreementLevel: ClaimCluster['agreementLevel'] = 'low';
    if (uniqueSources.size >= 3 && lanes.length >= 2) {
      agreementLevel = 'high';
    } else if (uniqueSources.size >= 2) {
      agreementLevel = 'medium';
    }

    clusters.push({
      clusterId: randomUUID(),
      representativeText: cluster[0].text,
      supportingClaims: cluster.map((c) => ({
        claimId: c.id,
        sourceId: c.sourceId,
        lane: c.lane,
      })),
      lanesCovered: lanes.length > 0 ? lanes : ['UNKNOWN'],
      agreementLevel,
    });
  }

  return clusters;
};

/**
 * Categorizes clusters into shared facts, conflicts, and unique angles.
 */
const categorizeClaimClusters = (
  clusters: ClaimCluster[],
): {
  sharedFacts: ClaimCluster[];
  conflicts: ClaimCluster[];
  uniqueAngles: ClaimCluster[];
} => {
  const sharedFacts: ClaimCluster[] = [];
  const conflicts: ClaimCluster[] = [];
  const uniqueAngles: ClaimCluster[] = [];

  for (const cluster of clusters) {
    const sourceCount = cluster.supportingClaims.length;
    const laneCount = cluster.lanesCovered.length;

    // Shared facts: multiple sources across multiple lanes
    if (sourceCount >= 2 && laneCount >= 2) {
      sharedFacts.push(cluster);
    }
    // Unique angles: single source or single lane dominance
    else if (sourceCount === 1 || laneCount === 1) {
      uniqueAngles.push(cluster);
    }
    // Conflicts: detected disagreement (future enhancement)
    else {
      conflicts.push(cluster);
    }
  }

  // Sort by agreement level and source count
  const sortByRelevance = (a: ClaimCluster, b: ClaimCluster) => {
    const levelOrder = { high: 0, medium: 1, low: 2 };
    const levelDiff = levelOrder[a.agreementLevel] - levelOrder[b.agreementLevel];
    if (levelDiff !== 0) return levelDiff;
    return b.supportingClaims.length - a.supportingClaims.length;
  };

  sharedFacts.sort(sortByRelevance);
  uniqueAngles.sort(sortByRelevance);

  return { sharedFacts, conflicts, uniqueAngles };
};

/**
 * Generates a neutral summary of the triangulated news using the LLM.
 */
const generateNeutralSummary = async (
  sharedFacts: ClaimCluster[],
  conflicts: ClaimCluster[],
  uniqueAngles: ClaimCluster[],
  laneCounts: Record<Lane, number>,
  llm: BaseChatModel,
): Promise<string> => {
  const sharedFactsText = sharedFacts
    .slice(0, 5)
    .map((c) => `- ${c.representativeText}`)
    .join('\n');

  const uniqueAnglesText = uniqueAngles
    .slice(0, 3)
    .map((c) => `- ${c.representativeText} (${c.lanesCovered.join(', ')})`)
    .join('\n');

  const laneBreakdown = Object.entries(laneCounts)
    .filter(([, count]) => count > 0)
    .map(([lane, count]) => `${lane}: ${count}`)
    .join(', ');

  const prompt = `You are a neutral news summarizer. Based on the following claims extracted from multiple news sources across different political perspectives, write a balanced 2-3 sentence summary.

Source distribution: ${laneBreakdown}

Shared facts (reported by multiple sources):
${sharedFactsText || 'None identified'}

Unique angles (reported by single sources):
${uniqueAnglesText || 'None identified'}

Guidelines:
- Be neutral and factual
- Acknowledge uncertainty where sources disagree
- Do not favor any political perspective
- Keep it concise (2-3 sentences)

Summary:`;

  try {
    const response = await llm.invoke(prompt);
    const content =
      typeof response.content === 'string'
        ? response.content
        : String(response.content);
    return content.trim();
  } catch (err) {
    console.error('Summary generation failed:', err);
    return 'Unable to generate summary. Please review the sources below for details.';
  }
};

/**
 * Builds the full triangulated news result from sources, claims, and clusters.
 */
const buildTriangulatedResult = async (
  sources: NewsSource[],
  llm: BaseChatModel,
  embeddings: Embeddings,
): Promise<TriangulatedNewsResult> => {
  // Extract claims from all sources (parallel)
  const claimArrays = await Promise.all(
    sources.map((source) => extractClaimsFromSource(source, llm)),
  );
  const allClaims = claimArrays.flat();

  // Build claim clusters
  const clusters = await buildClaimClusters(allClaims, embeddings);

  // Categorize clusters
  const { sharedFacts, conflicts, uniqueAngles } = categorizeClaimClusters(clusters);

  // Calculate lane counts
  const laneCounts = sources.reduce<Record<Lane, number>>(
    (acc, source) => {
      const lane = source.lane ?? 'UNKNOWN';
      acc[lane] = (acc[lane] ?? 0) + 1;
      return acc;
    },
    { LEFT: 0, RIGHT: 0, CENTER: 0, UNKNOWN: 0 },
  );

  // Generate neutral summary
  const summary = await generateNeutralSummary(
    sharedFacts,
    conflicts,
    uniqueAngles,
    laneCounts,
    llm,
  );

  return {
    summary,
    sharedFacts: sharedFacts.slice(0, 10),
    conflicts: conflicts.slice(0, 5),
    uniqueAngles: uniqueAngles.slice(0, 5),
    lanes: Object.entries(laneCounts)
      .filter(([, count]) => count > 0)
      .map(([lane, count]) => ({ lane: lane as Lane, count })),
    sources,
  };
};

export class NewsTriangulationAgent implements MetaSearchAgentType {
  async searchAndAnswer(
    message: string,
    _history: any[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    _optimizationMode: any,
    _fileIds: string[],
    _systemInstructions: string,
  ) {
    const emitter = new EventEmitter();

    queueMicrotask(async () => {
      try {
        // Phase 1: Fetch and normalize news sources
        const sources = await fetchNormalizedNewsResults(message, {
          engines: ['bing news'],
          pageno: 1,
          language: 'en',
          limit: 40,
          perDomainCap: 2,
        });

        // Phase 2: Tag lanes and balance sources
        const tagged = withLaneTags(sources);
        const balanced = selectBalancedNewsSources(tagged);

        // Phase 3/4: Extract claims, cluster, and build triangulated result
        const result = await buildTriangulatedResult(balanced, llm, embeddings);

        // Emit structured response
        emitter.emit(
          'data',
          JSON.stringify({ type: 'response', data: result.summary }),
        );

        emitter.emit(
          'data',
          JSON.stringify({
            type: 'sources',
            data: {
              sources: result.sources,
              sharedFacts: result.sharedFacts,
              conflicts: result.conflicts,
              uniqueAngles: result.uniqueAngles,
              lanes: result.lanes,
            },
          }),
        );

        emitter.emit('end');
      } catch (error) {
        console.error('News triangulation failed:', error);
        emitter.emit('error', error);
      }
    });

    return emitter;
  }
}

