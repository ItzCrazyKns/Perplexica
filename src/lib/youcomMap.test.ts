import assert from 'node:assert/strict';
import { mapYoucomResults } from './youcomMap.ts';

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

console.log('mapYoucomResults');

test('maps a standard result with title, url, snippet', () => {
  const out = mapYoucomResults([
    { title: 'Rust', url: 'https://rust-lang.org', snippet: 'A language empowering everyone' },
  ]);
  assert.deepEqual(out, [
    { title: 'Rust', url: 'https://rust-lang.org', content: 'A language empowering everyone' },
  ]);
});

test('falls back to description when snippet is absent', () => {
  const out = mapYoucomResults([
    { title: 'A', url: 'https://a.com', description: 'desc text' },
  ]);
  assert.equal(out[0].content, 'desc text');
});

test('falls back to content field when snippet and description absent', () => {
  const out = mapYoucomResults([
    { title: 'A', url: 'https://a.com', content: 'raw content' },
  ]);
  assert.equal(out[0].content, 'raw content');
});

test('uses url as title when title is missing', () => {
  const out = mapYoucomResults([{ url: 'https://notitle.com' }]);
  assert.equal(out[0].title, 'https://notitle.com');
  assert.equal(out[0].content, '');
});

test('drops entries without a url', () => {
  const out = mapYoucomResults([
    { title: 'no url', snippet: 'x' },
    { title: 'ok', url: 'https://ok.com', snippet: 'y' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].url, 'https://ok.com');
});

test('returns empty array for non-array input', () => {
  assert.deepEqual(mapYoucomResults(null as unknown), []);
  assert.deepEqual(mapYoucomResults(undefined as unknown), []);
  assert.deepEqual(mapYoucomResults({} as unknown), []);
});

test('returns empty array for empty input', () => {
  assert.deepEqual(mapYoucomResults([]), []);
});

console.log(`\n${passed} tests passed`);
