import test from 'node:test';
import assert from 'node:assert/strict';
import { createToolCallXmlFilter } from './stripToolCallXml.ts';

const run = (chunks: string[]): string => {
  const f = createToolCallXmlFilter();
  return chunks.map((c) => f.write(c)).join('') + f.flush();
};

test('plain text passes through unchanged', () => {
  assert.equal(run(['Hello ', 'world.']), 'Hello world.');
});

test('strips a complete tool_call span', () => {
  assert.equal(
    run(['Before <tool_call>{"name":"web_search"}</tool_call> after']),
    'Before  after',
  );
});

test('strips function/parameter XML split across many chunks', () => {
  assert.equal(
    run([
      'Answer: <fun',
      'ction=web_search><parameter=queries>["a","b"]</parameter></fun',
      'ction> done',
    ]),
    'Answer:  done',
  );
});

test('drops an unclosed span at stream end', () => {
  assert.equal(run(['Result. <tool_call>{"name":']), 'Result. ');
});

test('text containing lone angle brackets is preserved', () => {
  assert.equal(run(['a < b and b > c ', '<em>fine</em>']), 'a < b and b > c <em>fine</em>');
});

test('held partial opener that turns out to be text is released', () => {
  assert.equal(run(['see <to', 'day for details']), 'see <today for details');
});
