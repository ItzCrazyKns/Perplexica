import test from 'node:test';
import assert from 'node:assert/strict';
import { readNdjsonStream } from './ndjson.ts';

const streamOf = (parts: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      parts.forEach((p) => controller.enqueue(encoder.encode(p)));
      controller.close();
    },
  });
};

test('delivers each complete line exactly once', async () => {
  const seen: any[] = [];

  await readNdjsonStream(
    streamOf(['{"a":1}\n{"a":2}\n', '{"a":3}\n']),
    (d) => seen.push(d),
  );

  assert.deepEqual(seen, [{ a: 1 }, { a: 2 }, { a: 3 }]);
});

test('does not replay earlier lines when a chunk ends mid-object', async () => {
  const seen: any[] = [];

  /* The first chunk holds two complete lines plus a fragment. The old
     parser re-dispatched the complete ones on the next read. */
  await readNdjsonStream(
    streamOf(['{"a":1}\n{"a":2}\n{"a":', '3}\n']),
    (d) => seen.push(d),
  );

  assert.deepEqual(seen, [{ a: 1 }, { a: 2 }, { a: 3 }]);
});

test('handles a line split across many chunks', async () => {
  const seen: any[] = [];

  await readNdjsonStream(
    streamOf(['{"lo', 'ng":', '"val', 'ue"}', '\n']),
    (d) => seen.push(d),
  );

  assert.deepEqual(seen, [{ long: 'value' }]);
});

test('emits a trailing line that arrives without a newline', async () => {
  const seen: any[] = [];

  await readNdjsonStream(streamOf(['{"a":1}']), (d) => seen.push(d));

  assert.deepEqual(seen, [{ a: 1 }]);
});
