import BaseEmbedding from '@/lib/models/base/embedding';
import {
  ElementCoverage,
  LabeledTechnicalElement,
  PrimaryReference,
  RankedDocument,
} from '../schemas';

export type CoverageOptions = {
  threshold: number;
  topRefsPerElement?: number;
  primaryReferenceMinFraction?: number;
};

export type CoverageResult = {
  elementCoverage: ElementCoverage[];
  primaryReference: PrimaryReference | null;
};

const DEFAULT_TOP_REFS_PER_ELEMENT = 5;
const DEFAULT_PRIMARY_REF_MIN_FRACTION = 0.2;

export async function computeCoverage(
  elements: LabeledTechnicalElement[],
  refs: RankedDocument[],
  embedder: BaseEmbedding<unknown>,
  opts: CoverageOptions,
): Promise<CoverageResult> {
  if (!elements.length || !refs.length) {
    return { elementCoverage: [], primaryReference: null };
  }
  const topRefsPerElement = opts.topRefsPerElement ?? DEFAULT_TOP_REFS_PER_ELEMENT;
  const minFraction = opts.primaryReferenceMinFraction ?? DEFAULT_PRIMARY_REF_MIN_FRACTION;

  const elementTexts = elements.map(
    (e) => `${e.name}. ${e.description} ${e.noveltyHypothesis}`,
  );
  const refTexts = refs.map((r) =>
    [r.title, r.abstract, r.firstIndependentClaim]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .join(' '),
  );

  const elementVecs = await embedder.embedText(elementTexts);
  const refVecs = await embedder.embedText(refTexts);

  // matchMatrix[i][j] = 1 if element i matches ref j at threshold; cosine ∈ [-1, 1]
  const cosineMatrix: number[][] = elementVecs.map((ev) =>
    refVecs.map((rv) => cosine(ev, rv)),
  );

  const elementCoverage: ElementCoverage[] = elements.map((el, i) => {
    const row = cosineMatrix[i];
    const ranked = row
      .map((sim, j) => ({ sim, ref: refs[j] }))
      .sort((a, b) => b.sim - a.sim);
    const above = ranked.filter((r) => r.sim >= opts.threshold);
    const hitCount = above.length;
    const maxSimilarity = row.length ? Math.max(...row) : 0;
    return {
      label: el.label,
      name: el.name,
      hitCount,
      maxSimilarity,
      novelty:
        hitCount === 0
          ? 'likely_novel'
          : hitCount <= 2
            ? 'partial'
            : 'anticipated_risk',
      matchingRefs: above.slice(0, topRefsPerElement).map((r) => ({
        publicationNumber: r.ref.publicationNumber,
        similarity: r.sim,
      })),
    };
  });

  // Primary reference = ref covering the largest fraction of elements
  const refCoverageCounts = refs.map((_, j) =>
    elementCoverage.reduce(
      (n, ec, i) => n + (cosineMatrix[i][j] >= opts.threshold ? 1 : 0),
      0,
    ),
  );
  let bestJ = -1;
  for (let j = 0; j < refs.length; j++) {
    if (bestJ === -1 || refCoverageCounts[j] > refCoverageCounts[bestJ]) {
      bestJ = j;
    }
  }
  const bestFraction = bestJ >= 0 ? refCoverageCounts[bestJ] / elements.length : 0;
  let primaryReference: PrimaryReference | null = null;
  if (bestJ >= 0 && bestFraction >= minFraction) {
    const ref = refs[bestJ];
    const covered: string[] = [];
    const distinguishing: string[] = [];
    elements.forEach((el, i) => {
      if (cosineMatrix[i][bestJ] >= opts.threshold) covered.push(el.label);
      else distinguishing.push(el.label);
    });
    primaryReference = {
      publicationNumber: ref.publicationNumber,
      title: ref.title,
      elementCoverageFraction: bestFraction,
      coveredElements: covered,
      distinguishingElements: distinguishing,
    };
  }

  return { elementCoverage, primaryReference };
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
