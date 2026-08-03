import test from 'node:test';
import assert from 'node:assert/strict';
import { withInactivityTimeout } from './streamTimeout.ts';

const gen = async function* (chunks: string[], delayMs = 0) {
  for (const c of chunks) {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    yield c;
  }
};

test('passes chunks through unchanged', async () => {
  const out: string[] = [];
  for await (const c of withInactivityTimeout(
    gen(['a', 'b', 'c']),
    1000,
    'x',
  )) {
    out.push(c);
  }
  assert.deepEqual(out, ['a', 'b', 'c']);
});

test('tolerates gaps shorter than the limit', async () => {
  const out: string[] = [];
  for await (const c of withInactivityTimeout(gen(['a', 'b'], 20), 200, 'x')) {
    out.push(c);
  }
  assert.deepEqual(out, ['a', 'b']);
});

test('throws when the stream stalls past the limit', async () => {
  const stalled = async function* () {
    yield 'first';
    await new Promise((r) => setTimeout(r, 500));
    yield 'never delivered';
  };

  const out: string[] = [];
  await assert.rejects(async () => {
    for await (const c of withInactivityTimeout(stalled(), 60, 'writer')) {
      out.push(c);
    }
  }, /writer produced no output for 0.06s/);
  assert.deepEqual(out, ['first']);
});
