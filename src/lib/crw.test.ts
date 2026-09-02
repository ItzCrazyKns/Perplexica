import test from 'node:test';
import assert from 'node:assert/strict';
import { searchCrw } from './crw';

/*
 * No-network unit test for the fastCRW search provider. Mirrors the shape of
 * the SearXNG provider: searchCrw() returns { results, suggestions }. fetch is
 * stubbed so the test never hits the network.
 */

const withMockedFetch = async (
  impl: (input: any, init: any) => Promise<Response> | Response,
  run: () => Promise<void>,
) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl as unknown as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
};

test('searchCrw posts to /v1/search and maps results', async () => {
  let calledUrl = '';
  let calledInit: any = null;

  await withMockedFetch(
    (input, init) => {
      calledUrl = input.toString();
      calledInit = init;
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              title: 'Example',
              url: 'https://example.com',
              description: 'An example result',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
    async () => {
      const { results, suggestions } = await searchCrw('hello world', {
        limit: 5,
      });

      assert.ok(calledUrl.endsWith('/v1/search'));
      assert.equal(calledInit.method, 'POST');
      assert.deepEqual(JSON.parse(calledInit.body), {
        query: 'hello world',
        limit: 5,
      });

      assert.equal(results.length, 1);
      assert.equal(results[0].title, 'Example');
      assert.equal(results[0].url, 'https://example.com');
      assert.equal(results[0].content, 'An example result');
      assert.deepEqual(suggestions, []);
    },
  );
});

test('searchCrw throws on an unsuccessful envelope', async () => {
  await withMockedFetch(
    () =>
      new Response(
        JSON.stringify({ success: false, error: 'bad request' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    async () => {
      await assert.rejects(() => searchCrw('boom'), /fastCRW error: bad request/);
    },
  );
});

test('searchCrw throws on a non-ok response', async () => {
  await withMockedFetch(
    () => new Response('nope', { status: 500, statusText: 'Server Error' }),
    async () => {
      await assert.rejects(() => searchCrw('boom'), /fastCRW error/);
    },
  );
});
