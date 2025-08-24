import type { ExtractedDoc } from './readerExtractorTool';
import type { Embeddings } from '@langchain/core/embeddings';
import computeSimilarity from '@/lib/utils/computeSimilarity';

export type Cluster = {
  label: string;
  docUrls: string[];
  summary?: string;
  noveltyScore?: number; // heuristic 0–1
  subquestionScores?: Record<string, number>;
  coverageBySubquestion?: Record<string, number>; // 0–1 coverage fraction
  coverageScore?: number; // aggregate coverage for the cluster
};

export async function clusterCompressTool(
  extracted: ExtractedDoc[],
  embeddings: Embeddings,
  opts?: { targetClusters?: number },
  subquestions: string[] = [],
): Promise<Cluster[]> {
  if (!extracted.length) return [];
  const target = Math.min(
    opts?.targetClusters ?? 3,
    Math.max(1, Math.ceil(extracted.length / 4)),
  );

  // Build vectors for docs
  const texts = extracted.map((d) =>
    `${d.title || ''}\n${d.facts.join(' ')}\n${d.quotes.join(' ')}`.slice(
      0,
      2000,
    ),
  );
  const vecs = await embeddings.embedDocuments(texts);
  // Precompute subquestion vectors (for coverage mapping)
  const subqVecs: number[][] = [];
  for (const sq of subquestions) {
    // eslint-disable-next-line no-await-in-loop
    const v = await embeddings.embedQuery(sq);
    subqVecs.push(v);
  }

  // Greedy seeding
  const centers: number[][] = [];
  const centerIdxs: number[] = [];
  if (vecs.length) {
    centerIdxs.push(0);
    centers.push(vecs[0]);
  }
  while (centers.length < target && centers.length < vecs.length) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < vecs.length; i++) {
      if (centerIdxs.includes(i)) continue;
      const minSimToCenters = Math.min(
        ...centers.map((c) => computeSimilarity(vecs[i], c)),
      );
      // pick the lowest similarity to existing centers to maximize spread
      const score = -minSimToCenters;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      centers.push(vecs[bestIdx]);
      centerIdxs.push(bestIdx);
    } else break;
  }

  // Assign each doc to nearest center
  const assignments = new Array(vecs.length).fill(0).map(() => 0);
  for (let i = 0; i < vecs.length; i++) {
    let best = 0;
    let bestSim = -Infinity;
    for (let c = 0; c < centers.length; c++) {
      const sim = computeSimilarity(vecs[i], centers[c]);
      if (sim > bestSim) {
        bestSim = sim;
        best = c;
      }
    }
    assignments[i] = best;
  }

  // Build clusters
  const buckets: Record<number, ExtractedDoc[]> = {};
  assignments.forEach((cid, i) => {
    if (!buckets[cid]) buckets[cid] = [];
    buckets[cid].push(extracted[i]);
  });

  // Summaries (very brief)
  const clusters: Cluster[] = Object.keys(buckets).map((k, idx) => {
    const docs = buckets[Number(k)];
    const label = `Cluster-${idx + 1}`;
    const summary = docs
      .flatMap((d) => d.facts.slice(0, 2))
      .slice(0, 4)
      .join(' • ');
    return { label, summary, docUrls: docs.map((d) => d.url) };
  });

  // Compute simple novelty scores and map to subquestions
  // Novelty: proportion of unique domains across docs
  function domainOf(url: string) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }
  for (let i = 0; i < clusters.length; i++) {
    const docs = buckets[Number(Object.keys(buckets)[i])];
    const domains = new Set(docs.map((d) => domainOf(d.url)).filter(Boolean));
    const novelty = Math.min(1, domains.size / Math.max(1, docs.length));
    clusters[i].noveltyScore = Number(novelty.toFixed(2));

    // Subquestion mapping via centroid similarity
    if (subquestions.length > 0) {
      // Compute centroid
      const idxs = assignments
        .map((cid, j) => (cid === Number(Object.keys(buckets)[i]) ? j : -1))
        .filter((v) => v >= 0);
      let centroid: number[] | null = null;
      for (const j of idxs) {
        if (!centroid) centroid = [...vecs[j]];
        else centroid = centroid.map((v, k) => v + vecs[j][k]);
      }
      if (centroid) centroid = centroid.map((v) => v / idxs.length);
      const scores: Record<string, number> = {};
      for (const sq of subquestions) {
        const qv = subqVecs[subquestions.indexOf(sq)];
        const sim = centroid ? computeSimilarity(centroid, qv) : 0;
        scores[sq] = Number(sim.toFixed(3));
      }
      clusters[i].subquestionScores = scores;

      // Coverage mapping: fraction of docs in this cluster with similarity to each subquestion above a threshold
      const coverage: Record<string, number> = {};
      const threshold = 0.45; // heuristic
      for (let s = 0; s < subquestions.length; s++) {
        const qv = subqVecs[s];
        if (!qv) {
          coverage[subquestions[s]] = 0;
          continue;
        }
        let covered = 0;
        for (const j of idxs) {
          const sim = computeSimilarity(vecs[j], qv);
          if (sim >= threshold) covered++;
        }
        coverage[subquestions[s]] = idxs.length
          ? Number((covered / idxs.length).toFixed(2))
          : 0;
      }
      clusters[i].coverageBySubquestion = coverage;
      const avgCoverage = Object.values(coverage).length
        ? Object.values(coverage).reduce((a, b) => a + b, 0) /
          Object.values(coverage).length
        : 0;
      clusters[i].coverageScore = Number(avgCoverage.toFixed(2));
    }
  }

  return clusters;
}
