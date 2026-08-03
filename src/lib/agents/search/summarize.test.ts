import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSummaryIntent } from './summarize.ts';

test('Discover click-through format is summary intent', () => {
  assert.deepEqual(
    detectSummaryIntent('Summary: https://example.com/article'),
    ['https://example.com/article'],
  );
});

test('bare pasted link is summary intent', () => {
  assert.deepEqual(detectSummaryIntent('https://example.com/a'), [
    'https://example.com/a',
  ]);
});

test('french summarize verb is summary intent', () => {
  assert.deepEqual(
    detectSummaryIntent('résume https://example.com/a stp'),
    ['https://example.com/a'],
  );
});

test('a real question with a link is not summary intent', () => {
  assert.equal(
    detectSummaryIntent(
      'What does the author say about pricing in https://example.com/a compared to competitors?',
    ),
    null,
  );
});

test('no url means no summary intent', () => {
  assert.equal(detectSummaryIntent('summarize our discussion'), null);
});
