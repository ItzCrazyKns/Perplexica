import { getEncoding } from 'js-tiktoken';

const splitRegex = /(?<=\. |\n|! |\? |; |:\s|\d+\.\s|- |\* )/g;

const enc = getEncoding('cl100k_base');

export const getTokenCount = (text: string): number => {
  try {
    return enc.encode(text).length;
  } catch {
    return Math.ceil(text.length / 4);
  }
};

/*
 * Largest prefixes of `segment` that each fit in maxTokens. The split
 * regex is sentence based and knows nothing about CJK punctuation, so
 * a single "segment" can be an entire document.
 */
const hardSplitSegment = (segment: string, maxTokens: number): string[] => {
  const pieces: string[] = [];
  let rest = segment;

  while (rest.length > 0) {
    /* Exponential window before the binary search: encoding the full
       remainder per probe made CJK splits quadratic in encode cost
       (minutes for a few thousand chars). Every probe here encodes at
       most a couple of piece lengths. */
    let lo = 0;
    let hi = Math.min(rest.length, maxTokens);

    while (hi < rest.length && getTokenCount(rest.slice(0, hi)) <= maxTokens) {
      lo = hi;
      hi = Math.min(rest.length, hi * 2);
    }

    if (getTokenCount(rest.slice(0, hi)) <= maxTokens) {
      pieces.push(rest);
      break;
    }

    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (getTokenCount(rest.slice(0, mid)) <= maxTokens) lo = mid;
      else hi = mid;
    }

    let cut = Math.max(lo, 1);

    /* Do not strand a high surrogate at the cut. */
    const last = rest.charCodeAt(cut - 1);
    if (cut > 1 && last >= 0xd800 && last <= 0xdbff) cut--;

    pieces.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }

  return pieces;
};

export const splitText = (
  text: string,
  maxTokens = 512,
  overlapTokens = 64,
): string[] => {
  const rawSegments = text.split(splitRegex).filter(Boolean);

  if (rawSegments.length === 0) {
    return [];
  }

  /* An oversized segment would never fit a chunk, leaving chunkEnd at
     chunkStart and looping forever. Break those up first. */
  const segments: string[] = [];
  const segmentTokenCounts: number[] = [];

  for (const raw of rawSegments) {
    const count = getTokenCount(raw);

    if (count <= maxTokens) {
      segments.push(raw);
      segmentTokenCounts.push(count);
      continue;
    }

    for (const piece of hardSplitSegment(raw, maxTokens)) {
      segments.push(piece);
      segmentTokenCounts.push(getTokenCount(piece));
    }
  }

  const result: string[] = [];

  let chunkStart = 0;

  while (chunkStart < segments.length) {
    let chunkEnd = chunkStart;
    let currentTokenCount = 0;

    while (chunkEnd < segments.length && currentTokenCount < maxTokens) {
      if (currentTokenCount + segmentTokenCounts[chunkEnd] > maxTokens) {
        break;
      }

      currentTokenCount += segmentTokenCounts[chunkEnd];
      chunkEnd++;
    }

    let overlapBeforeStart = Math.max(0, chunkStart - 1);
    let overlapBeforeTokenCount = 0;

    while (overlapBeforeStart >= 0 && overlapBeforeTokenCount < overlapTokens) {
      if (
        overlapBeforeTokenCount + segmentTokenCounts[overlapBeforeStart] >
        overlapTokens
      ) {
        break;
      }

      overlapBeforeTokenCount += segmentTokenCounts[overlapBeforeStart];
      overlapBeforeStart--;
    }

    const overlapStartIndex = Math.max(0, overlapBeforeStart + 1);

    const overlapBeforeContent = segments
      .slice(overlapStartIndex, chunkStart)
      .join('');

    const chunkContent = segments.slice(chunkStart, chunkEnd).join('');

    result.push(overlapBeforeContent + chunkContent);

    /* Never stand still, whatever the token counts say. */
    chunkStart = chunkEnd > chunkStart ? chunkEnd : chunkStart + 1;
  }

  return result;
};
