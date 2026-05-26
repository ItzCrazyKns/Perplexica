import { PatentDocument } from '../schemas';
import { PriorArtSource } from '../sources/base';

export type VerifierResult<T> = {
  output: T;
  warnings: string[];
};

const PUB_REGEX = /\b([A-Z]{2}-?\d{4,}-?[A-Z]?\d?)\b/g;

export function extractCitations(text: string): string[] {
  const seen = new Set<string>();
  const matches = text.match(PUB_REGEX);
  if (!matches) return [];
  for (const m of matches) seen.add(m.replaceAll('-', ''));
  return [...seen];
}

export async function verifyCitations<T extends { toString(): string }>(
  emitted: T,
  retrieved: PatentDocument[],
  sources: PriorArtSource[],
): Promise<VerifierResult<T>> {
  const retrievedSet = new Set(retrieved.map((d) => d.publicationNumber.replace('-', '')));
  const cites = extractCitations(JSON.stringify(emitted));
  const warnings: string[] = [];
  for (const cite of cites) {
    if (retrievedSet.has(cite)) continue;
    const resolved = await tryResolve(cite, sources);
    if (!resolved) warnings.push(`Unverified citation: ${cite}`);
  }
  return { output: emitted, warnings };
}

async function tryResolve(
  cite: string,
  sources: PriorArtSource[],
): Promise<PatentDocument | null> {
  for (const src of sources) {
    try {
      const doc = await src.fetch(cite);
      if (doc) return doc;
    } catch {
      /* try next source */
    }
  }
  return null;
}

export function stripUnverified<T>(value: T, unverifiedCitations: string[]): T {
  if (!unverifiedCitations.length) return value;
  let json = JSON.stringify(value);
  for (const c of unverifiedCitations) {
    json = json.replaceAll(c, '[UNVERIFIED_CITATION_REMOVED]');
  }
  return JSON.parse(json) as T;
}
