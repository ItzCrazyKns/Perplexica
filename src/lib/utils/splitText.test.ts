import test from 'node:test';
import assert from 'node:assert/strict';
import { splitText, getTokenCount } from './splitText.ts';

test('splits ordinary prose into chunks within the token budget', () => {
  const text = Array.from(
    { length: 200 },
    (_, i) => `This is sentence number ${i}. `,
  ).join('');

  const chunks = splitText(text, 64, 8);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length > 0));
});

test('terminates on a single segment larger than maxTokens', () => {
  /* No sentence break the splitter recognises, so the whole document
     arrives as one oversized segment. Previously looped forever. */
  const text = '句'.repeat(5000);

  const chunks = splitText(text, 128, 16);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => getTokenCount(c) <= 128 + 16));
  assert.equal(chunks.join('').includes('句'), true);
});

test('preserves all content across chunk boundaries', () => {
  const text = Array.from({ length: 50 }, (_, i) => `Fact ${i}. `).join('');

  const chunks = splitText(text, 32, 0);

  assert.equal(chunks.join(''), text);
});

test('returns an empty array for empty input', () => {
  assert.deepEqual(splitText('', 128, 16), []);
});
