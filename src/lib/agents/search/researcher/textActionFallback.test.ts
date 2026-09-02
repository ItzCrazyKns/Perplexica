import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTextActions } from './textActionFallback.ts';

const TOOLS = ['web_search', 'done', 'scrape_url'];

test('parses the Action: name [array] narration', () => {
  const calls = parseTextActions(
    'Action: web_search ["latest kernel", "kernel 6.12"] then done.',
    TOOLS,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'web_search');
  assert.deepEqual(calls[0].arguments, {
    queries: ['latest kernel', 'kernel 6.12'],
  });
});

test('parses call-style narration with keyword args', () => {
  const calls = parseTextActions(
    '<tool_code>\nweb_search(query="perplexity alternatives self hosted")\n</tool_code>',
    TOOLS,
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].arguments, {
    queries: ['perplexity alternatives self hosted'],
  });
});

test('parses raw template XML with a JSON array parameter', () => {
  const calls = parseTextActions(
    '<tool_call><function=web_search><parameter=queries>["a", "b"]</parameter></function></tool_call>',
    TOOLS,
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].arguments, { queries: ['a', 'b'] });
});

test('multiple distinct narrated calls parse in order, duplicates collapse', () => {
  const calls = parseTextActions(
    'web_search ["a"] then web_search ["a"] then scrape_url ["https://x.example/p"]',
    TOOLS,
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0].name, 'web_search');
  assert.equal(calls[1].name, 'scrape_url');
  assert.deepEqual(calls[1].arguments, { urls: ['https://x.example/p'] });
});

test('parses the function_name XML variant', () => {
  const calls = parseTextActions(
    '<function_calls>\n<function>\n<function_name>scrape_url</function_name>\n<function_parameters>\n{"urls": ["https://example.com/a"]}\n</function_parameters>\n</function>\n</function_calls>',
    TOOLS,
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].arguments, { urls: ['https://example.com/a'] });
});

test('prose without arguments yields nothing', () => {
  assert.deepEqual(
    parseTextActions(
      'I will use web_search to find the answer, then finish.',
      TOOLS,
    ),
    [],
  );
});

test('unavailable tools are ignored', () => {
  assert.deepEqual(
    parseTextActions('academic_search ["paper"]', ['web_search', 'done']),
    [],
  );
});
