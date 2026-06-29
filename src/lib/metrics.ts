export interface TokensPerSecondInput {
  responseStartedAt?: number;
  completedAt?: number;
  text: string;
}

/**
 * Roughly estimates the number of tokens in a piece of text.
 *
 * Uses the common heuristic that one token is about three-quarters of a word
 * (tokens ≈ words × 4/3). This keeps the metric cheap and synchronous for a
 * display-only value, avoiding bundling a full tokenizer into the client.
 */
export const estimateTokenCount = (text: string): number => {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.round(words * (4 / 3));
};

/**
 * Computes an approximate generation speed in tokens/second for a completed
 * response.
 *
 * Returns null when timing data is missing or the duration is not positive —
 * e.g. while a message is still streaming, or for restored/historical messages
 * that never recorded timestamps.
 */
export const computeTokensPerSecond = ({
  responseStartedAt,
  completedAt,
  text,
}: TokensPerSecondInput): number | null => {
  if (!responseStartedAt || !completedAt || completedAt <= responseStartedAt) {
    return null;
  }

  const tokens = estimateTokenCount(text);
  if (tokens === 0) return null;

  const seconds = (completedAt - responseStartedAt) / 1000;
  return tokens / seconds;
};
