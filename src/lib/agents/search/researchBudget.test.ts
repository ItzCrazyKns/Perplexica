import test from 'node:test';
import assert from 'node:assert/strict';
import { ResearchBudget } from './researchBudget.ts';

test('run returns null once the deadline has passed', async () => {
  const budget = new ResearchBudget({ maxConcurrency: 2, timeLimitMs: -1 });

  const result = await budget.run(async () => 'work');

  assert.equal(result, null);
});

test('caps concurrent tasks at maxConcurrency', async () => {
  const budget = new ResearchBudget({
    maxConcurrency: 2,
    timeLimitMs: 60_000,
  });

  let running = 0;
  let peak = 0;

  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      budget.run(async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 10));
        running--;
        return i;
      }),
    ),
  );

  assert.equal(peak <= 2, true);
  assert.deepEqual(
    results.sort((a, b) => (a as number) - (b as number)),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
});

test('tasks queued past the deadline are skipped, earlier ones finish', async () => {
  const budget = new ResearchBudget({ maxConcurrency: 1, timeLimitMs: 30 });

  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      budget.run(async () => {
        await new Promise((r) => setTimeout(r, 25));
        return 'done';
      }),
    ),
  );

  assert.equal(results[0], 'done');
  assert.equal(results[results.length - 1], null);
});
