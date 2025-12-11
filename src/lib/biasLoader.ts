/**
 * Media Bias & Credibility Loader
 *
 * Loads bias and credibility data from data/bias/media_bias.csv (~4,500 domains).
 * Data sourced from Media Bias/Fact Check and includes:
 *   - Political bias (LEFT/CENTER/RIGHT/UNKNOWN)
 *   - Factual reporting rating
 *   - Credibility rating
 *   - Press freedom score
 *
 * Unknown domains are logged to data/bias/unknown_domains.txt for expansion.
 *
 * Scoring weights:
 *   - Factual reporting: 40%
 *   - Credibility rating: 35%
 *   - Press freedom: 25%
 */

import { readFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';

export type Lane = 'LEFT' | 'RIGHT' | 'CENTER' | 'UNKNOWN';

export interface SourceCredibility {
  lane: Lane;
  factualReporting: number; // 0-1 scale
  credibilityRating: number; // 0-1 scale
  pressFreedom: number; // 0-1 scale
  overallScore: number; // Weighted composite 0-1
}

/**
 * Factual reporting score mapping (weight: 40%)
 * Note: "DO NOT USE" entries are skipped entirely in loadCredibilityMap
 */
const FACTUAL_SCORES: Record<string, number> = {
  'very high': 1.0,
  high: 0.85,
  'high (industry specific)': 0.85,
  'mostly factual': 0.7,
  mixed: 0.5,
  'mixed (opinion heavy)': 0.45,
  low: 0.3,
  'low (clickbait/ai)': 0.15,
  'very low': 0.1,
  'n/a (blog)': 0.3,
  'n/a': 0.3,
};

/**
 * Credibility rating score mapping (weight: 35%)
 */
const CREDIBILITY_SCORES: Record<string, number> = {
  'high credibility': 1.0,
  'medium credibility': 0.6,
  'mixed credibility': 0.5,
  'low credibility': 0.2,
  'not rated': 0.3,
};

/**
 * Press freedom score mapping (weight: 25%)
 */
const PRESS_FREEDOM_SCORES: Record<string, number> = {
  excellent: 1.0,
  'mostly free': 0.9,
  'mostly freedom': 0.9,
  'mosty free': 0.9, // typo in data
  'moderate freedom': 0.7,
  'limited freedom': 0.5,
  'minimal freedom': 0.3,
  'total oppression': 0.1,
};

/**
 * Parse press freedom rankings like "usa 45/180" or "Problematic Situation (Rank ~55)" to a 0-1 score
 */
const parsePressFreedomRanking = (value: string): number | null => {
  // Standard format: "usa 45/180"
  const standardMatch = value.match(/(\d+)\/(\d+)/);
  if (standardMatch) {
    const rank = parseInt(standardMatch[1], 10);
    const total = parseInt(standardMatch[2], 10);
    // Lower rank is better, so invert: 1/180 = ~1.0, 180/180 = ~0
    return Math.max(0, 1 - rank / total);
  }

  // New format: "Problematic Situation (Rank ~55)"
  const rankMatch = value.match(/rank\s*~?\s*(\d+)/i);
  if (rankMatch) {
    const rank = parseInt(rankMatch[1], 10);
    // Assume out of 180 (RSF scale)
    return Math.max(0, 1 - rank / 180);
  }

  // Handle categorical "problematic" descriptions
  if (value.toLowerCase().includes('problematic')) {
    return 0.65; // Slightly below moderate
  }

  return null;
};

/**
 * Calculate composite credibility score
 * Weights: Factual 40%, Credibility 35%, Press Freedom 25%
 */
const calculateOverallScore = (
  factual: number,
  credibility: number,
  pressFreedom: number,
): number => {
  return factual * 0.4 + credibility * 0.35 + pressFreedom * 0.25;
};

/**
 * Maps MBFC bias categories to our simplified Lane types.
 * Categories are normalized to lowercase for matching.
 */
const BIAS_TO_LANE: Record<string, Lane> = {
  // LEFT
  left: 'LEFT',
  'left biased': 'LEFT',
  'left-center': 'LEFT',
  'left center': 'LEFT',
  'left-center bias': 'LEFT',
  'left-center – pro-science': 'LEFT',
  'left-center pro-science': 'LEFT',
  'pro-science/left-center': 'LEFT',
  'pro-science (left-leaning)': 'LEFT',
  'left leaning pro-science': 'LEFT',
  'far left': 'LEFT',
  'far-left': 'LEFT',
  'far left bias': 'LEFT',
  'extreme left': 'LEFT',
  'left – pseudoscience': 'LEFT',
  'left pseudoscience': 'LEFT',
  'left-pseudoscience': 'LEFT',
  'left conspiracy-pseudoscience': 'LEFT',
  'left-conspiracy/pseudoscience': 'LEFT',

  // RIGHT
  right: 'RIGHT',
  'right-center': 'RIGHT',
  'far right': 'RIGHT',
  'far-right': 'RIGHT',
  'far right-bias': 'RIGHT',
  'extreme right': 'RIGHT',
  'extreme-right': 'RIGHT',
  'alt-right conspiracy': 'RIGHT',
  'extreme right conspiracy': 'RIGHT',
  'extreme right conspiracy-pseudoscience': 'RIGHT',
  'far right conspiracy-pseusdoscience': 'RIGHT',
  'far-right conspiracy-pseudoscience': 'RIGHT',
  'right – conspiracy': 'RIGHT',
  'right – conspiracy and pseudoscience': 'RIGHT',
  'right conspiracy': 'RIGHT',
  'right conspiracy – pseudoscience': 'RIGHT',
  'right conspiracy pseudoscience': 'RIGHT',
  'right conspiracy- pseudoscience': 'RIGHT',
  'right conspiracy/pseudoscience': 'RIGHT',
  'right conspiracy=pseudoscience': 'RIGHT',
  'right conspiracy-pseudoscience': 'RIGHT',
  'right pseudoscience': 'RIGHT',
  'right-conspiracy': 'RIGHT',
  'right-conspiracy/pseudoscience': 'RIGHT',
  'right-conspiracy-pseudoscience': 'RIGHT',
  'right-pseudoscience': 'RIGHT',
  'right-psuedoscience': 'RIGHT',
  'pseudoscience right biased': 'RIGHT',

  // CENTER
  'least biased': 'CENTER',
  'least biased (data focused)': 'CENTER',
  'pro-business (commercial)': 'CENTER',
  'pro-business (market)': 'CENTER',
  'pro-science': 'CENTER',
  'pro- science': 'CENTER',
  'least – pro science': 'CENTER',
  'least pro-science': 'CENTER',
  'pro-science / least biased': 'CENTER',

  // Industry/Specialty sources (treat as CENTER for balance)
  'pro-crypto': 'CENTER',
  'pro-crypto (mainstream)': 'CENTER',
  commercial: 'CENTER',

  // Progressive left
  'left (progressive)': 'LEFT',
};

/**
 * Categories we exclude from triangulation (low credibility).
 * These will return 'UNKNOWN' so they can be deprioritized.
 */
const EXCLUDED_CATEGORIES = new Set([
  'conspiracy',
  'conspiracy and pseudoscience',
  'conspiracy- pseudoscience',
  'conspiracy/pseudoscience',
  'conspiracy-pseudoscience',
  'pseudoscience',
  'quackery pseudoscience',
  'junk news',
  'not rated',
  'unrated',
  'n/a', // Unknown/unvetted sources
]);

// Cache for loaded bias data (now includes full credibility info)
let credibilityMap: Map<string, SourceCredibility> | null = null;

/**
 * Parses a simple CSV line (handles basic quoting).
 */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

/**
 * Loads the media bias CSV and builds a domain-to-credibility map.
 * Caches the result for subsequent calls.
 *
 * CSV columns: source, country, bias, factual_reporting, press_freedom,
 *              media_type, popularity, mbfc_credibility_rating
 */
export const loadCredibilityMap = (): Map<string, SourceCredibility> => {
  if (credibilityMap) return credibilityMap;

  credibilityMap = new Map<string, SourceCredibility>();

  try {
    // Try multiple possible paths (dev vs production)
    const possiblePaths = [
      join(process.cwd(), 'data', 'bias', 'media_bias.csv'),
      join(__dirname, '..', '..', '..', 'data', 'bias', 'media_bias.csv'),
    ];

    let csvContent: string | null = null;
    for (const path of possiblePaths) {
      try {
        csvContent = readFileSync(path, 'utf-8');
        break;
      } catch {
        continue;
      }
    }

    if (!csvContent) {
      console.warn(
        '[BiasLoader] Could not find media_bias.csv, using empty map',
      );
      return credibilityMap;
    }

    const lines = csvContent.split('\n');
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields = parseCSVLine(line);
      if (fields.length < 8) continue;

      const source = fields[0].toLowerCase().trim();
      const bias = fields[2]?.toLowerCase().trim() || '';
      const factualReporting = fields[3]?.toLowerCase().trim() || '';
      const pressFreedom = fields[4]?.toLowerCase().trim() || '';
      const credibilityRating = fields[7]?.toLowerCase().trim() || '';

      if (!source || !bias) continue;

      // Skip domains marked as "DO NOT USE" (clickbait, content farms, etc.)
      if (factualReporting.includes('do not use')) {
        continue;
      }

      // Skip excluded categories (conspiracy, pseudoscience, etc.)
      if (EXCLUDED_CATEGORIES.has(bias)) {
        continue;
      }

      // Map bias to lane
      const lane = BIAS_TO_LANE[bias] || 'UNKNOWN';

      // Only include sources with a known lane
      if (lane === 'UNKNOWN') continue;

      // Calculate scores
      const factualScore = FACTUAL_SCORES[factualReporting] ?? 0.5;
      const credibilityScore = CREDIBILITY_SCORES[credibilityRating] ?? 0.5;

      // Parse press freedom (handle both categorical and ranking formats)
      let pressFreedomScore = PRESS_FREEDOM_SCORES[pressFreedom];
      if (pressFreedomScore === undefined) {
        const rankingScore = parsePressFreedomRanking(pressFreedom);
        pressFreedomScore = rankingScore ?? 0.7; // Default to moderate
      }

      const overallScore = calculateOverallScore(
        factualScore,
        credibilityScore,
        pressFreedomScore,
      );

      credibilityMap.set(source, {
        lane,
        factualReporting: factualScore,
        credibilityRating: credibilityScore,
        pressFreedom: pressFreedomScore,
        overallScore,
      });
    }

    console.log(
      `[BiasLoader] Loaded ${credibilityMap.size} domains with credibility scores`,
    );
  } catch (err) {
    console.error('[BiasLoader] Error loading bias CSV:', err);
  }

  return credibilityMap;
};

// Legacy function for backward compatibility
export const loadBiasMap = (): Map<string, Lane> => {
  const credMap = loadCredibilityMap();
  const laneMap = new Map<string, Lane>();
  credMap.forEach((cred, domain) => laneMap.set(domain, cred.lane));
  return laneMap;
};

// Track unknown domains we've seen (for logging/research)
const unknownDomainsSet = new Set<string>();
const UNKNOWN_DOMAINS_LOG_PATH = join(
  process.cwd(),
  'data',
  'bias',
  'unknown_domains.txt',
);

/**
 * Logs an unknown domain to file for later research.
 * Only logs each domain once per session.
 */
const logUnknownDomain = (domain: string): void => {
  if (unknownDomainsSet.has(domain)) return;
  unknownDomainsSet.add(domain);

  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const logLine = `${timestamp}\t${domain}\n`;
    appendFileSync(UNKNOWN_DOMAINS_LOG_PATH, logLine);
  } catch {
    // Silently fail if we can't write (e.g., permissions)
  }
};

/**
 * Gets all unknown domains encountered this session.
 */
export const getUnknownDomains = (): string[] => {
  return Array.from(unknownDomainsSet);
};

/**
 * Reads all unknown domains from the log file.
 */
export const readUnknownDomainsLog = (): Array<{
  date: string;
  domain: string;
}> => {
  try {
    if (!existsSync(UNKNOWN_DOMAINS_LOG_PATH)) return [];

    const content = readFileSync(UNKNOWN_DOMAINS_LOG_PATH, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [date, domain] = line.split('\t');
        return { date, domain };
      });
  } catch {
    return [];
  }
};

/**
 * Default credibility for unknown domains
 */
const DEFAULT_CREDIBILITY: SourceCredibility = {
  lane: 'UNKNOWN',
  factualReporting: 0.5,
  credibilityRating: 0.5,
  pressFreedom: 0.7,
  overallScore: 0.55,
};

/**
 * Default credibility for .gov/.edu domains (assumed high quality)
 */
const GOV_EDU_CREDIBILITY: SourceCredibility = {
  lane: 'CENTER',
  factualReporting: 0.9,
  credibilityRating: 0.85,
  pressFreedom: 0.9,
  overallScore: 0.88,
};

/**
 * Looks up a domain in the credibility map, handling subdomains.
 */
const lookupDomain = (domain: string): SourceCredibility | null => {
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
  const map = loadCredibilityMap();

  // Direct lookup
  if (map.has(cleanDomain)) {
    return map.get(cleanDomain)!;
  }

  // Try without subdomains (e.g., news.bbc.com -> bbc.com)
  const parts = cleanDomain.split('.');
  if (parts.length > 2) {
    const rootDomain = parts.slice(-2).join('.');
    if (map.has(rootDomain)) {
      return map.get(rootDomain)!;
    }
  }

  return null;
};

/**
 * Gets the full credibility data for a domain.
 * Logs unknown domains to file for later research.
 */
export const getCredibilityForDomain = (domain: string): SourceCredibility => {
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '');

  // Check our database
  const cred = lookupDomain(cleanDomain);
  if (cred) return cred;

  // Heuristics for domains not in CSV
  // Government and educational institutions (including international)
  if (
    cleanDomain.endsWith('.gov') ||
    cleanDomain.endsWith('.gov.au') ||
    cleanDomain.endsWith('.gov.uk') ||
    cleanDomain.endsWith('.edu') ||
    cleanDomain.endsWith('.edu.au') ||
    cleanDomain.endsWith('.ac.uk') ||
    cleanDomain.endsWith('.edu.sg')
  ) {
    return GOV_EDU_CREDIBILITY;
  }

  // International NGOs and established organizations (high credibility)
  if (
    cleanDomain.includes('unicef.org') ||
    cleanDomain.includes('amnesty.org') ||
    cleanDomain.includes('who.int') ||
    cleanDomain.includes('un.org')
  ) {
    return GOV_EDU_CREDIBILITY;
  }

  // Log this unknown domain for research
  logUnknownDomain(cleanDomain);

  return DEFAULT_CREDIBILITY;
};

/**
 * Gets the lane for a domain, using the loaded bias map.
 * Falls back to heuristics for .gov/.edu domains.
 */
export const getLaneForDomain = (domain: string): Lane => {
  return getCredibilityForDomain(domain).lane;
};

/**
 * Gets the overall credibility score (0-1) for a domain.
 * Higher is better.
 */
export const getCredibilityScore = (domain: string): number => {
  return getCredibilityForDomain(domain).overallScore;
};

/**
 * Checks if a domain is in our bias database.
 */
export const isKnownDomain = (domain: string): boolean => {
  return lookupDomain(domain) !== null;
};

/**
 * Gets a human-readable credibility label.
 */
export const getCredibilityLabel = (
  score: number,
): 'high' | 'medium' | 'low' => {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
};
