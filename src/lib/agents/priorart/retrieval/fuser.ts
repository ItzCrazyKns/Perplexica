import { PatentDocument, RankedDocument } from '../schemas';

export type SignalRanking = {
  signal: string;
  ranking: string[];
};

const RRF_K = 60;

export function familyPrefix(publicationNumber: string): string {
  const m = publicationNumber.match(/^([A-Z]{2})[-]?(\d+)/);
  if (!m) return publicationNumber;
  return `${m[1]}${m[2]}`;
}

export function reciprocalRankFuse(
  documents: PatentDocument[],
  signals: SignalRanking[],
  topK: number,
): RankedDocument[] {
  const docsByPub = new Map<string, PatentDocument>();
  for (const d of documents) docsByPub.set(d.publicationNumber, d);

  const scores = new Map<string, number>();
  const ranksBySource = new Map<string, Record<string, number>>();

  for (const signal of signals) {
    signal.ranking.forEach((pub, idx) => {
      const score = 1 / (RRF_K + idx + 1);
      scores.set(pub, (scores.get(pub) ?? 0) + score);
      const r = ranksBySource.get(pub) ?? {};
      r[signal.signal] = idx + 1;
      ranksBySource.set(pub, r);
    });
  }

  const seenFamily = new Set<string>();
  const ranked: RankedDocument[] = [];
  const sortedPubs = [...scores.entries()].sort((a, b) => b[1] - a[1]);

  for (const [pub, score] of sortedPubs) {
    const doc = docsByPub.get(pub);
    if (!doc) continue;
    const fam = familyPrefix(pub);
    if (seenFamily.has(fam)) continue;
    seenFamily.add(fam);
    ranked.push({
      ...doc,
      fusedScore: score,
      sourceRanks: ranksBySource.get(pub) ?? {},
    });
    if (ranked.length >= topK) break;
  }
  return ranked;
}
