import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicHttpUrl } from './urlGuard.ts';

/*
 * Node normalizes IPv4-mapped IPv6 into hex hextets, so the dotted
 * forms below do not reach the guard as written. Keep them covered.
 */
const cases: [string, boolean][] = [
  ['http://169.254.169.254/latest/meta-data/', false],
  ['http://127.0.0.1:8080/', false],
  ['http://localhost:3000/', false],
  ['http://sub.localhost/', false],
  ['http://[::1]/', false],
  ['http://[::]/', false],
  ['http://10.0.0.5/', false],
  ['http://192.168.1.1/', false],
  ['http://172.16.0.1/', false],
  ['http://172.31.255.255/', false],
  ['http://172.32.0.1/', true],
  ['http://100.64.0.1/', false],
  ['http://0.0.0.0/', false],
  ['http://[::ffff:127.0.0.1]/', false],
  ['http://[::ffff:10.0.0.1]/', false],
  ['http://[0:0:0:0:0:ffff:127.0.0.1]/', false],
  ['http://[::ffff:8.8.8.8]/', true],
  ['http://[fd00::1]/', false],
  ['http://[fe80::1]/', false],
  ['http://[2606:4700:4700::1111]/', true],
  ['file:///etc/passwd', false],
  ['ftp://example.com/', false],
  ['http://metadata.google.internal/', false],
  ['http://foo.local/', false],
  ['http://foo.internal/', false],
  ['not a url', false],
];

test('isPublicHttpUrl blocks private, loopback and metadata targets', async () => {
  for (const [url, expected] of cases) {
    assert.equal(await isPublicHttpUrl(url), expected, `${url}`);
  }
});

test('isPublicHttpUrl allows ordinary public hosts', async () => {
  assert.equal(await isPublicHttpUrl('https://example.com/path?q=1'), true);
});
