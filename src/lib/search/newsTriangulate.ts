/**
 * News Triangulation Agent
 *
 * Searches for news articles across multiple sources, categorizes them by
 * political lean (LEFT/RIGHT/CENTER), extracts factual claims, and clusters
 * them to identify:
 *   - Shared facts (claims verified by multiple sources across lanes)
 *   - Conflicts (claims where sources disagree)
 *   - Unique angles (perspectives only covered by one source/lane)
 *
 * Bias data is loaded from data/bias/media_bias.csv (~4,500 domains).
 * Unknown domains are logged to data/bias/unknown_domains.txt for expansion.
 *
 * @see src/types/newsTriangulate.ts for type definitions
 * @see src/lib/biasLoader.ts for bias data loading
 */

import EventEmitter from 'events';
import { randomUUID } from 'node:crypto';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import type { BaseMessage } from '@langchain/core/messages';
import { MetaSearchAgentType } from './metaSearchAgent';
import { searchSearxng } from '../searxng';
import computeSimilarity from '../utils/computeSimilarity';
import formatChatHistoryAsString from '../utils/formatHistory';
import {
  Lane,
  NewsSource,
  NewsClaim,
  ClaimCluster,
  TriangulatedNewsResult,
} from '@/types/newsTriangulate';
import { getLaneForDomain, getCredibilityScore } from '@/lib/biasLoader';

type FetchOptions = {
  engines?: string[];
  pageno?: number;
  language?: string;
  limit?: number;
  perDomainCap?: number;
};

type NormalizedResult = NewsSource;

const DEFAULT_FETCH_OPTS: Required<
  Pick<FetchOptions, 'limit' | 'perDomainCap'>
> = {
  limit: 40,
  perDomainCap: 2,
};

// Target 2-3 sources per lane for balanced coverage (8-12 total ideal)
const DEFAULT_BALANCE_PER_LANE = 3;

/**
 * Bias data is now loaded from data/bias/media_bias.csv (~4500 domains)
 * using the biasLoader module. The CSV is sourced from Media Bias/Fact Check.
 */

/**
 * Rewrite a contextual follow-up into a standalone news query.
 * Keeps search relevant when users say “tell me more” or “what about…”.
 */
const rewriteQueryWithHistory = async (
  query: string,
  history: BaseMessage[],
  llm: BaseChatModel,
): Promise<string> => {
  // If no history or query seems standalone, return as-is
  if (history.length === 0) return query;

  // Quick heuristic: if query is long enough and doesn't contain obvious follow-up phrases, skip LLM
  const followUpPatterns =
    /^(tell me more|what about|how about|and|also|more on|expand|continue|go on|elaborate)/i;
  const isShortQuery = query.split(' ').length <= 4;

  if (!followUpPatterns.test(query) && !isShortQuery) {
    return query;
  }

  const historyStr = formatChatHistoryAsString(history);

  const prompt = `You are a news search query optimizer. Given a conversation history and a follow-up question, rewrite the question as a standalone news search query that would find relevant current news articles.

Conversation History:
${historyStr}

Follow-up Question: ${query}

Rewrite as a standalone news search query (output ONLY the query, nothing else):`;

  try {
    const response = await llm.invoke(prompt);
    const rewritten =
      typeof response.content === 'string'
        ? response.content.trim()
        : String(response.content).trim();

    // Sanity check: if rewritten is empty or too short, use original
    return rewritten.length >= 3 ? rewritten : query;
  } catch {
    return query;
  }
};

/**
 * Extract hostname (without www) from a URL.
 */
const getDomain = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * Fetch normalized news results from SearXNG with per-domain caps to avoid dominance.
 */
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
  const seenUrls = new Set<string>();

  for (const result of res.results) {
    if (!result.url || !result.title) continue;

    // Deduplicate by URL to avoid repeated listings of the same article
    if (seenUrls.has(result.url)) continue;
    seenUrls.add(result.url);

    const domain = getDomain(result.url);
    if (!domain) continue;

    const current = domainCounts.get(domain) ?? 0;
    if (current >= perDomainCap) continue;

    domainCounts.set(domain, current + 1);

    // Pick best available image (og:image or thumbnail from search engine)
    const imageUrl =
      result.img_src || result.thumbnail_src || result.thumbnail || undefined;

    normalized.push({
      id: randomUUID(),
      url: result.url,
      title: result.title,
      snippet: result.content ?? '',
      domain,
      sourceName: domain,
      timestamp: (result as any).publishedDate ?? undefined,
      imageUrl,
    });

    if (normalized.length >= limit) break;
  }

  return normalized;
};

/**
 * Tags a domain with its political lane using the loaded bias database.
 * Uses getLaneForDomain from biasLoader which handles ~4500 domains.
 */
const tagLaneForDomain = (domain: string): Lane => {
  return getLaneForDomain(domain);
};

/**
 * Tags sources with their political lane and credibility score.
 */
const withLaneAndCredibility = (sources: NewsSource[]): NewsSource[] =>
  sources.map((s) => ({
    ...s,
    lane: s.lane ?? tagLaneForDomain(s.domain),
    credibilityScore: s.credibilityScore ?? getCredibilityScore(s.domain),
  }));

/**
 * Safely parse a timestamp; returns Date or undefined when invalid.
 */
const parseTimestamp = (ts?: string) => {
  if (!ts) return undefined;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/**
 * Selects a balanced set of sources across lanes.
 * Prioritizes known political lanes (LEFT/RIGHT/CENTER) over UNKNOWN.
 * UNKNOWN sources are capped and only used to fill gaps.
 */
export const selectBalancedNewsSources = (
  sources: NewsSource[],
  perLane: number = DEFAULT_BALANCE_PER_LANE,
  maxUnknown: number = 2, // Cap unknown sources to avoid diluting triangulation
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

  /**
   * Sort by credibility first, then by recency.
   * This ensures we pick the most reliable sources within each lane.
   */
  const sortByCredibilityThenRecency = (a: NewsSource, b: NewsSource) => {
    // Primary: higher credibility first
    const credDiff = (b.credibilityScore ?? 0.5) - (a.credibilityScore ?? 0.5);
    if (Math.abs(credDiff) > 0.1) return credDiff;

    // Secondary: more recent first
    const aDate = parseTimestamp(a.timestamp)?.getTime() ?? 0;
    const bDate = parseTimestamp(b.timestamp)?.getTime() ?? 0;
    if (aDate !== bDate) return bDate - aDate;

    return a.title.localeCompare(b.title);
  };

  (Object.keys(grouped) as Lane[]).forEach((lane) =>
    grouped[lane].sort(sortByCredibilityThenRecency),
  );

  const balanced: NewsSource[] = [];
  const knownLanes: Lane[] = ['LEFT', 'RIGHT', 'CENTER'];

  // First pass: ensure at least 1 from each known lane if available
  for (const lane of knownLanes) {
    if (grouped[lane].length > 0 && !balanced.some((s) => s.lane === lane)) {
      balanced.push(grouped[lane][0]);
    }
  }

  // Second pass: fill up to perLane for each KNOWN lane
  for (const lane of knownLanes) {
    const alreadyAdded = balanced.filter((s) => s.lane === lane).length;
    const remaining = perLane - alreadyAdded;

    if (remaining > 0) {
      balanced.push(
        ...grouped[lane].slice(alreadyAdded, alreadyAdded + remaining),
      );
    }
  }

  // Third pass: add UNKNOWN sources only to fill gaps (capped)
  const knownCount = balanced.length;
  const targetTotal = perLane * 3; // Ideal: 3 lanes * perLane
  const unknownSlots = Math.min(
    maxUnknown,
    Math.max(0, targetTotal - knownCount),
    grouped.UNKNOWN.length,
  );

  if (unknownSlots > 0) {
    balanced.push(...grouped.UNKNOWN.slice(0, unknownSlots));
  }

  return balanced;
};

/**
 * Extract structured claims from a news source using the LLM.
 * Returns an array of claims with metadata (who, when, where, type).
 */
const extractClaimsFromSource = async (
  source: NewsSource,
  llm: BaseChatModel,
): Promise<NewsClaim[]> => {
  const prompt = `You are a claim extraction system. Extract factual claims and key context from this news article.

Title: ${source.title}
Content: ${source.snippet || 'No content available'}

Return a JSON array of claims. Each claim should have:
- "text": the claim statement (COMPLETE sentences, do not truncate. Include specific context like numbers, dates, and quotes.)
- "who": who is making or involved in the claim (if mentioned)
- "when": when did this happen (if mentioned)
- "where": location (if mentioned)
- "type": one of "fact", "opinion", "quote", or "other"
- "confidence": "high" if directly stated, "medium" if implied, "low" if uncertain

Return ONLY valid JSON array. Example:
[{"text":"The president signed the bill on Tuesday, providing $12 billion in aid.","who":"president","when":"Tuesday","where":"White House","type":"fact","confidence":"high"}]

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
      claimType: (['fact', 'opinion', 'quote', 'other'].includes(
        claim.type || '',
      )
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
/**
 * Cluster claims using embeddings and cosine similarity.
 * Picks the longest claim text as the representative for readability.
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
    const lanes = [
      ...new Set(cluster.map((c) => c.lane).filter(Boolean)),
    ] as Lane[];
    const uniqueSources = new Set(cluster.map((c) => c.sourceId));

    // Determine agreement level based on source diversity
    let agreementLevel: ClaimCluster['agreementLevel'] = 'low';
    if (uniqueSources.size >= 3 && lanes.length >= 2) {
      agreementLevel = 'high';
    } else if (uniqueSources.size >= 2) {
      agreementLevel = 'medium';
    }

    // Determine representative text (longest/most descriptive claim in cluster)
    const representativeText = cluster.reduce((prev, current) =>
      current.text.length > prev.text.length ? current : prev,
    ).text;

    clusters.push({
      clusterId: randomUUID(),
      representativeText,
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
/**
 * Split clusters into shared facts, conflicts, and unique angles.
 * - Shared facts: high agreement across lanes
 * - Conflicts: disagreeing claims present
 * - Unique angles: dominated by one lane
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
    const levelDiff =
      levelOrder[a.agreementLevel] - levelOrder[b.agreementLevel];
    if (levelDiff !== 0) return levelDiff;
    return b.supportingClaims.length - a.supportingClaims.length;
  };

  sharedFacts.sort(sortByRelevance);
  uniqueAngles.sort(sortByRelevance);

  return { sharedFacts, conflicts, uniqueAngles };
};

/**
 * Generates a neutral, triangulated summary emphasizing cross-spectrum agreement and disagreement.
 */
/**
 * Generate a Reuters/AP-style briefing with dynamic headers and balance notes.
 */
const generateNeutralSummary = async (
  sharedFacts: ClaimCluster[],
  conflicts: ClaimCluster[],
  uniqueAngles: ClaimCluster[],
  laneCounts: Record<Lane, number>,
  sources: NewsSource[],
  llm: BaseChatModel,
  hasFullSpectrum: boolean = true,
): Promise<string> => {
  const sharedFactsText = sharedFacts
    .slice(0, 5)
    .map((c) => `- ${c.representativeText} [${c.lanesCovered.join(', ')}]`)
    .join('\n');

  const conflictsText = conflicts
    .slice(0, 3)
    .map((c) => `- ${c.representativeText}`)
    .join('\n');

  const uniqueAnglesText = uniqueAngles
    .slice(0, 3)
    .map(
      (c) =>
        `- ${c.representativeText} (from ${c.lanesCovered.join(', ')} sources)`,
    )
    .join('\n');

  const laneBreakdown = Object.entries(laneCounts)
    .filter(([, count]) => count > 0)
    .map(([lane, count]) => `${lane}: ${count}`)
    .join(', ');

  // Calculate average credibility
  const avgCredibility =
    sources.length > 0
      ? sources.reduce((sum, s) => sum + (s.credibilityScore ?? 0.5), 0) /
        sources.length
      : 0.5;
  const credibilityLabel =
    avgCredibility >= 0.75
      ? '🟢 High'
      : avgCredibility >= 0.5
        ? '🟡 Medium'
        : '🔴 Low';

  // Check for single-lane dominance (80%+ from one perspective)
  const totalSources = Object.values(laneCounts).reduce((a, b) => a + b, 0);
  const dominantLane = Object.entries(laneCounts)
    .filter(([lane]) => lane !== 'UNKNOWN')
    .find(([, count]) => count / totalSources >= 0.8);

  let spectrumNote = '';
  if (dominantLane) {
    spectrumNote = `*⚠ Limited diversity: ${Math.round((dominantLane[1] / totalSources) * 100)}% of sources are ${dominantLane[0].toLowerCase()}-leaning*`;
  } else if (!hasFullSpectrum) {
    spectrumNote = `*⚠ Limited spectrum: No ${laneCounts.LEFT === 0 ? 'left' : 'right'}-leaning sources available*`;
  }

  // Detect polarized conflicts (conflicts that include both LEFT and RIGHT lanes)
  const hasPolarizedConflicts = conflicts.some(
    (c) => c.lanesCovered.includes('LEFT') && c.lanesCovered.includes('RIGHT'),
  );

  const prompt = `You are a senior journalist at Reuters writing a comprehensive news briefing. Create a fluid, professional article that synthesizes information across political perspectives.

RULES:
- Use ONLY facts from the provided claims. Never invent details.
- Write naturally—no bracketed tags like [LEFT] or [CENTER] in prose
- Use natural attribution: "according to reports", "analysts noted", "officials said"
- Create DYNAMIC section headers based on the actual content themes (NOT generic headers like "Key Points" or "What We Know")

SOURCE MIX: ${laneBreakdown}

VERIFIED CLAIMS (multiple sources agree):
${sharedFactsText || 'Limited cross-verification available'}

DISPUTED/CONFLICTING:
${conflictsText || 'No major disputes identified'}

UNIQUE ANGLES:
${uniqueAnglesText || 'None'}

---

Write a news briefing in this structure:

# [Compelling, specific headline]

*${laneBreakdown.replace(/:/g, ':').replace(/,/g, ' |')} sources | Credibility: ${credibilityLabel}*
${spectrumNote ? `\n${spectrumNote}` : ''}

[OPENING: 2-3 sentence lead covering the core story. Hook the reader with the most newsworthy element.]

[MAIN NARRATIVE: 3-4 flowing paragraphs telling the story. Weave in verified facts, specific figures, reactions. Use inverted pyramid—most important first. Attribute naturally.]

---

Now organize key details into 2-4 THEMATIC SECTIONS based on what's actually in the claims. Examples of good dynamic headers:
- For crypto: "Market Indicators", "Regulatory Response", "Investor Sentiment"  
- For politics: "Policy Changes", "Political Reactions", "Economic Impact"
- For tech: "Technical Details", "Industry Response", "User Impact"

Each section should have:
- A **bold contextual header** (NOT generic like "Key Facts")
- 3-5 bullet points with specific details from claims
- Natural prose connecting the bullets when helpful

---

${
  hasPolarizedConflicts
    ? `**Disputed Details Between Left and Right**

[Explain the disagreements with clear attribution. Example: "Conservative outlets emphasized X, while liberal sources focused on Y." Be specific about WHO says WHAT and what details differ. Keep this to 1-2 short paragraphs focused on the dispute itself.]

---

`
    : ''
}**Analysis & Context**

[1-2 paragraphs: Why this matters. What happens next. Historical context if relevant. Keep it analytical and forward-looking.]

---

Target: 500-800 words. Read like Reuters or AP—authoritative, balanced, informative.`;

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
/**
 * Full pipeline: claims -> clusters -> categories -> summary.
 * Returns the structured TriangulatedNewsResult for UI rendering.
 */
const buildTriangulatedResult = async (
  sources: NewsSource[],
  llm: BaseChatModel,
  embeddings: Embeddings,
  hasFullSpectrum: boolean = true,
): Promise<TriangulatedNewsResult> => {
  // Extract claims from all sources (parallel)
  const claimArrays = await Promise.all(
    sources.map((source) => extractClaimsFromSource(source, llm)),
  );
  const allClaims = claimArrays.flat();

  // Build claim clusters
  const clusters = await buildClaimClusters(allClaims, embeddings);

  // Categorize clusters
  const { sharedFacts, conflicts, uniqueAngles } =
    categorizeClaimClusters(clusters);

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
    sources,
    llm,
    hasFullSpectrum,
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

/**
 * NewsTriangulationAgent
 * End-to-end triangulation over news: fetch → balance → claims → clusters → summary.
 */
export class NewsTriangulationAgent implements MetaSearchAgentType {
  async searchAndAnswer(
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    _optimizationMode: any,
    _fileIds: string[],
    _systemInstructions: string,
  ) {
    const emitter = new EventEmitter();

    // Prevent unhandled rejection warnings if no error listener attached
    emitter.on('error', () => {});

    queueMicrotask(async () => {
      try {
        // Rewrite query using history for contextual follow-ups
        const searchQuery = await rewriteQueryWithHistory(
          message,
          history,
          llm,
        );

        // Phase 1: Fetch and normalize news sources from multiple engines
        let sources = await fetchNormalizedNewsResults(searchQuery, {
          engines: ['bing news', 'google news', 'duckduckgo'],
          pageno: 1,
          language: 'en',
          limit: 40,
          perDomainCap: 2,
        });

        // If we're missing LEFT or RIGHT, fetch a second page with a higher cap to try to pull in missing lanes
        const hasLeftInitial = sources.some(
          (s) => tagLaneForDomain(s.domain) === 'LEFT',
        );
        const hasRightInitial = sources.some(
          (s) => tagLaneForDomain(s.domain) === 'RIGHT',
        );
        if (!hasLeftInitial || !hasRightInitial) {
          const extra = await fetchNormalizedNewsResults(searchQuery, {
            engines: ['bing news', 'google news', 'duckduckgo'],
            pageno: 2,
            language: 'en',
            limit: 80,
            perDomainCap: 3,
          });
          // Deduplicate by URL
          const seen = new Set(sources.map((s) => s.url));
          sources = sources.concat(extra.filter((s) => !seen.has(s.url)));
        }

        // Phase 2: Tag lanes and balance sources
        const tagged = withLaneAndCredibility(sources);
        const balanced = selectBalancedNewsSources(tagged);

        // Absolute minimum: need at least 3 sources for any meaningful comparison
        const MIN_SOURCES_ABSOLUTE = 3;

        // Check for political diversity - need at least 1 LEFT and 1 RIGHT for true triangulation
        const hasLeft = balanced.some((s) => s.lane === 'LEFT');
        const hasRight = balanced.some((s) => s.lane === 'RIGHT');
        const hasFullSpectrum = hasLeft && hasRight;

        // Phase 6: Logging for debugging and quality tuning
        const laneCounts = balanced.reduce<Record<Lane, number>>(
          (acc, source) => {
            const lane = source.lane ?? 'UNKNOWN';
            acc[lane] = (acc[lane] ?? 0) + 1;
            return acc;
          },
          { LEFT: 0, RIGHT: 0, CENTER: 0, UNKNOWN: 0 },
        );

        console.log(
          `[Triangulate] Query: "${searchQuery.substring(0, 50)}..." | Sources: ${balanced.length} | Lanes: L=${laneCounts.LEFT} R=${laneCounts.RIGHT} C=${laneCounts.CENTER} U=${laneCounts.UNKNOWN} | FullSpectrum: ${hasFullSpectrum}`,
        );

        // Handle zero or near-zero sources: can't triangulate at all
        if (balanced.length < MIN_SOURCES_ABSOLUTE) {
          const summary =
            balanced.length === 0
              ? 'No news sources found for this query. Try a more specific or recent news topic.'
              : `Only ${balanced.length} source${balanced.length === 1 ? '' : 's'} found. At least ${MIN_SOURCES_ABSOLUTE} sources are needed for triangulation. Try a broader news topic.`;

          const fallbackResult: TriangulatedNewsResult = {
            summary,
            sharedFacts: [],
            conflicts: [],
            uniqueAngles: [],
            lanes: Object.entries(laneCounts)
              .filter(([, count]) => count > 0)
              .map(([lane, count]) => ({ lane: lane as Lane, count })),
            sources: balanced,
          };

          emitter.emit(
            'data',
            JSON.stringify({ type: 'response', data: fallbackResult.summary }),
          );
          emitter.emit(
            'data',
            JSON.stringify({
              type: 'sources',
              data: {
                sources: fallbackResult.sources,
                sharedFacts: fallbackResult.sharedFacts,
                conflicts: fallbackResult.conflicts,
                uniqueAngles: fallbackResult.uniqueAngles,
                lanes: fallbackResult.lanes,
              },
            }),
          );
          emitter.emit('end');
          return;
        }

        // Phase 3/4: Extract claims, cluster, and build triangulated result
        const result = await buildTriangulatedResult(
          balanced,
          llm,
          embeddings,
          hasFullSpectrum,
        );

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

        // Emit user-friendly error response instead of crashing
        const errorMessage =
          'Unable to complete news triangulation. This may be due to search engine issues or LLM timeout. Please try again.';
        emitter.emit(
          'data',
          JSON.stringify({ type: 'response', data: errorMessage }),
        );
        emitter.emit(
          'data',
          JSON.stringify({
            type: 'sources',
            data: {
              sources: [],
              sharedFacts: [],
              conflicts: [],
              uniqueAngles: [],
              lanes: [],
            },
          }),
        );
        emitter.emit('end');
      }
    });

    return emitter;
  }
}
