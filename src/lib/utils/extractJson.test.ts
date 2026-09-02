/**
 * Test harness for extractJsonObject — no test runner is installed in this
 * repo, so this is a plain assertion script run via `npx tsx`.
 */
import { extractJsonObject } from './extractJson';

let failures = 0;
const eq = (label: string, actual: string, expected: string) => {
  const got = JSON.parse(actual);
  const want = JSON.parse(expected);
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) {
    failures++;
    console.error(`  ✗ ${label}`);
    console.error(`      expected: ${expected}`);
    console.error(`      actual:   ${actual}`);
  } else {
    console.log(`  ✓ ${label}`);
  }
};

// --- Regression: bare `</think` closer must NOT swallow the JSON payload ---
// Qwen3 emits "</think\n\n{...}" with no closing '>'. The buggy [^>]* ran to
// end-of-string and discarded the object.
eq(
  'bare </think closer (no >) preserves JSON',
  extractJsonObject('</think\n\n{"answer":42}'),
  '{"answer":42}',
);
eq(
  'bare </thinking closer (no >) preserves JSON',
  extractJsonObject('</thinking\n\n{"answer":42}'),
  '{"answer":42}',
);
eq('bare </think closer preserves nested object', extractJsonObject('</think\n\n{"a":{"b":1}}'), '{"a":{"b":1}}');

// --- Existing behavior must still hold ---
eq('proper </think> closer preserves JSON', extractJsonObject('</think>\n{"answer":42}'), '{"answer":42}');
eq('closer-with-attributes preserves JSON', extractJsonObject('</think foo>\n{"answer":42}'), '{"answer":42}');
eq('clean JSON idempotent', extractJsonObject('{"k":"v"}'), '{"k":"v"}');
eq('empty input returns {}', extractJsonObject(''), '{}');
eq('marker only returns {}', extractJsonObject('</think'), '{}');
// Markers inside JSON string values are NOT stripped (front-anchored peeling).
eq(
  'marker text inside string value preserved',
  extractJsonObject('{"note":"uses </think inside","x":3}'),
  '{"note":"uses </think inside","x":3}',
);
// Word-boundary: </thinkers-guide> must not match the think closer.
eq('word boundary not over-matched', extractJsonObject('</thinkers-guide>{"a":1}'), '{"a":1}');

// --- Regression: spurious leading { + stray quote must not nest the object ---
// A guided decoder emitted `{\n"{ "picked_indices": [...] }` — an extra opening
// brace and a stray double-quote with no matchers. The odd quote count defeats
// brace-balance tracking, so the prior repair never engaged and jsonrepair
// misread the `"` as an empty-string key, nesting the real object as
// `{"":{...}}` where the schema couldn't find picked_indices.
eq(
  'spurious leading { + stray quote recovers inner object',
  extractJsonObject('{\n "{ "picked_indices": [0, 11, 21] }\n'),
  '{ "picked_indices": [0, 11, 21] }',
);
eq(
  'plain quoted (unescaped) object unwrapped',
  extractJsonObject('"{ "picked_indices": [0, 11, 21] }"'),
  '{ "picked_indices": [0, 11, 21] }',
);
eq(
  'valid JSON-string-wrapped object unwrapped',
  extractJsonObject('"{ \\"picked_indices\\": [0, 11, 21] }"'),
  '{ "picked_indices": [0, 11, 21] }',
);

if (failures > 0) {
  console.error(`\n${failures} test(s) FAILED`);
  process.exit(1);
}
console.log(`\nAll tests passed.`);
