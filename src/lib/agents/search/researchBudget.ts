import { Semaphore } from 'async-mutex';

/*
 * Caps a research run. Quality mode iterates up to 25 times and each
 * iteration can fan out into scrapes and per-chunk extraction calls;
 * without a ceiling one question can hold dozens of concurrent LLM
 * calls and browser pages open with no end time.
 */
export class ResearchBudget {
  private semaphore: Semaphore;
  private deadlineAt: number;

  constructor(opts: { maxConcurrency: number; timeLimitMs: number }) {
    this.semaphore = new Semaphore(opts.maxConcurrency);
    this.deadlineAt = Date.now() + opts.timeLimitMs;
  }

  expired(): boolean {
    return Date.now() > this.deadlineAt;
  }

  /* Null means the budget ran out; callers treat it like a skipped
     unit of work and answer from what accumulated so far. */
  async run<T>(task: () => Promise<T>): Promise<T | null> {
    if (this.expired()) return null;

    const [, release] = await this.semaphore.acquire();

    try {
      if (this.expired()) return null;
      return await task();
    } finally {
      release();
    }
  }
}

export const createResearchBudget = (
  mode: 'speed' | 'balanced' | 'quality',
): ResearchBudget =>
  new ResearchBudget(
    mode === 'quality'
      ? { maxConcurrency: 5, timeLimitMs: 5 * 60 * 1000 }
      : { maxConcurrency: 5, timeLimitMs: 2 * 60 * 1000 },
  );
