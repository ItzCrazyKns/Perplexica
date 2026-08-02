import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, seedAllowedUrls } from './urlAllowlist.ts';

test('normalizeUrl strips fragments and trailing slashes', () => {
  assert.equal(
    normalizeUrl('https://example.com/page/#section'),
    'https://example.com/page',
  );
  assert.equal(normalizeUrl('https://example.com/'), 'https://example.com');
});

test('seeds URLs from user turns and the follow-up', () => {
  const allowed = seedAllowedUrls(
    [
      { role: 'user', content: 'Summarize https://example.com/a please' },
      { role: 'assistant', content: 'Sure. See https://evil.example/b' },
    ],
    'And compare with https://example.com/c/',
  );

  assert.ok(allowed.has('https://example.com/a'));
  assert.ok(allowed.has('https://example.com/c'));
  assert.ok(!allowed.has('https://evil.example/b'));
});

test('assistant-quoted URLs never enter the allowlist', () => {
  const allowed = seedAllowedUrls(
    [{ role: 'assistant', content: 'visit https://attacker.example/x' }],
    'what is the weather',
  );

  assert.equal(allowed.size, 0);
});
