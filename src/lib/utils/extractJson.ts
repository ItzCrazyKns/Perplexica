/**
 * Extract and repair a JSON object from a model response.
 *
 * Model output can arrive wrapped in reasoning markers, markdown fences, or
 * prose, and may be malformed. Most malformation (trailing commas, single
 * quotes, unquoted keys, truncation, fences, surrounding prose) is handled by
 * the downstream `jsonrepair` library. The one case no generic repair library
 * handles is a *spurious extra brace at the object boundary* — confirmed
 * against vLLM 0.25 serving reasoning models with strict `json_schema`
 * response_format, where the guided decoder emits a doubled/extra opening
 * brace with no matching closer:
 *   - Qwen3.6: adjacent "{{" (sometimes a trailing "}}")
 *   - GLM-5.2: "{\n{" (extra open with a newline, single closer)
 *
 * This util fixes that one structural issue (balance- and parse-driven, so it
 * generalizes to adjacent, whitespace-separated, symmetric, and tripled
 * variants) and then delegates the rest to `jsonrepair`. Idempotent on clean
 * JSON.
 */
import { jsonrepair } from 'jsonrepair';

export const extractJsonObject = (raw: string | null | undefined): string => {
  if (!raw) return '{}';

  // Reasoning markers and control tokens appear *before* the JSON object and
  // can put a stray { in front of the real one — for example a { that lives
  // inside a leading reasoning block ("consider the set {1,2,3}") — which
  // would mislead the brace-balance walk below. But the same literal text can
  // legitimately appear *inside* JSON string values (a field whose content
  // discusses markup, or model-emitted control-token sentinels the caller
  // wants preserved), so we must NOT strip markers across the whole string.
  //
  // Strip only *leading* marker blocks, anchored at the front, BEFORE locating
  // the first { — the order matters: slicing at the first { first would cut
  // inside a marker block and destroy the opening tag, leaving the block
  // un-strippable. Peeling front-anchored blocks first (complete reasoning
  // blocks, bare tag fragments, control tokens) removes a { that lives inside
  // a marker, so the next first { is the real object. Because peeling is
  // front-anchored and stops once no marker remains at the front, marker text
  // inside the JSON body is never touched.
  let s = raw.trimStart();
  for (;;) {
    const before = s;
    s = s
      // Closing '>' is optional: Qwen3 and similar models emit "</think\n\n"
      // (no angle bracket). Without this, a '{' inside the reasoning block
      // would become firstBrace and discard the actual JSON object.
      .replace(/^<think[\s\S]*?<\/think>?\s*/i, '')
      .replace(/^<thinking[\s\S]*?<\/thinking>?\s*/i, '')
      .replace(/^<\/?(?:think|thinking)>\s*/i, '')
      // Bare standalone closers without '>' (e.g. leading "</think\n\n{...}").
      // The optional (?:[^>]*>)? spans to a closing '>' when one exists; when
      // there is none (Qwen's "</think\n\n{...}" form) it matches nothing, so
      // the subsequent \s* consumes only the separating whitespace and the JSON
      // payload survives. A bare [^>]* would run away to end-of-string when no
      // '>' is present and swallow the whole object.
      .replace(/^<\/(?:think|thinking)(?=>|\s)(?:[^>]*>)?\s*/i, '')
      .replace(/^<\|[^|]*\|>\s*/, '')
      .trimStart();
    if (s === before) break; // no leading marker left to peel
  }

  // If the whole payload is a JSON string literal wrapping an object
  // (`"{ \"picked_indices\": [...] }"`), peel the quoting layer before locating
  // the first brace — otherwise the slice below would start at the leading `"`
  // and never reach the object. Runs first because it sees the full string.
  s = unwrapJsonString(s);

  const firstBrace = s.indexOf('{');
  if (firstBrace === -1) return '{}';
  // Slice off any residual prose between the last peeled marker and the object
  // (e.g. "Here is the JSON:" before the brace). The JSON body follows and is
  // kept verbatim from here on.
  s = s.slice(firstBrace);
  if (!s.startsWith('{')) return '{}';

  s = repairSpuriousBraces(s);
  // After brace repair, a stray double-quote can survive at the boundary (e.g.
  // a spurious leading `{` + `"` from a guided decoder, whose odd quote count
  // defeated balanceOf). jsonrepair misreads such a quote as an empty-string
  // key and nests the real object one level deeper
  // (`{"":{"picked_indices":...}}`), where the schema can't find its fields.
  // Anchor-scan to recover the innermost parseable object before delegating.
  s = anchorObject(s);

  // Delegate token-level repair (commas, quotes, truncation, fences, prose
  // tail) to jsonrepair. Fall back to the brace-fixed string if it throws.
  try {
    return jsonrepair(s);
  } catch {
    return s;
  }
};

// Walk the string tracking brace depth, ignoring braces inside JSON strings.
// Returns { ok: true, end } when the outer object closes, otherwise
// { ok: false, depth } (depth > 0: too many opens, < 0: too many closes).
//
// Both double- and single-quoted strings are tracked. `jsonrepair` can turn
// single-quoted values into valid JSON, so a `}` or `{` that appears inside a
// single-quoted value must NOT be counted as a structural brace — otherwise
// the object is truncated at the first in-string brace before jsonrepair ever
// runs (e.g. {'reason': 'failed } here', 'ok': true} would be cut at the
// inner `}`).
const balanceOf = (
  s: string,
): { ok: true; end: number } | { ok: false; depth: number } => {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inSingle) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inDouble = false;
      continue;
    }
    if (ch === '"') inDouble = true;
    else if (ch === "'") inSingle = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { ok: true, end: i };
    }
  }
  return { ok: false, depth };
};

const parses = (s: string): boolean => {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
};

// Unwrap a payload the model wrapped in a JSON string literal. When a guided
// decoder stringifies an object (or the model quotes the whole object), the
// raw content is a quoted JSON string (`"{ \"k\": 1 }"`) rather than the
// object — JSON.parse once yields a *string*, not the object, and schema.parse
// then fails ("expected array, received undefined" for nested fields). Detect
// that and peel one layer of quoting before the rest of the pipeline runs.
//
// Only act when the parsed string is itself JSON and the inner payload begins
// with a structural brace — so prose that merely contains braces ("foo {bar}")
// is left for jsonrepair, and a literal string scalar is returned unchanged.
const unwrapJsonString = (s: string): string => {
  if (!parses(s)) return s;
  let v: unknown;
  try {
    v = JSON.parse(s);
  } catch {
    return s;
  }
  if (typeof v !== 'string') return s;
  const inner = v.trimStart();
  if (!inner.startsWith('{')) return s;
  return parses(inner) ? inner : s;
};

// Recover the real object when spurious leading noise survives brace repair.
// A guided decoder can emit a stray `{` + `"` before the object
// (`{\n"{ "picked_indices": [...] }`). The odd quote count defeats balanceOf's
// string tracking, so repairSpuriousBraces never engages; jsonrepair would
// then treat the stray `"` as an empty-string key and nest the real object one
// level deep (`{"":{...}}`), hiding it from the schema.
//
// Parse-driven: try the full string, then every deeper `{` offset. Adopt the
// first slice that parses as a non-string JSON value whose outermost token is
// an object — that is the innermost real object. Only runs when the string
// doesn't already parse, so clean/already-repaired JSON is untouched.
const anchorObject = (s: string): string => {
  if (parses(s)) return s;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue;
    const candidate = s.slice(i);
    let v: unknown;
    try {
      v = JSON.parse(candidate);
    } catch {
      continue;
    }
    // Skip a string result — that is a quoted payload, not the object; an
    // earlier offset (the quote's own `{`, once unwrapped) is the real one.
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      return candidate;
    }
  }
  return s;
};

// Drop spurious extra braces at the object boundary. Pass 1 handles the
// asymmetric case (extra opens or extra closes); pass 2 handles the symmetric
// case ({{...}}: balanced but structurally invalid). A step is only adopted
// if the result still balances, so legitimate nested objects are untouched.
const repairSpuriousBraces = (s: string): string => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const balance = balanceOf(s);
    if (balance.ok) {
      s = s.slice(0, balance.end + 1);
      break;
    }
    if (balance.depth > 0 && s[0] === '{') {
      s = s.slice(1).replace(/^[\s\n]*/, '');
      if (s[0] !== '{') s = '{' + s;
      continue;
    }
    if (balance.depth < 0 && s.endsWith('}')) {
      s = s.replace(/[\s\n]*\}$/, '');
      if (!s.endsWith('}')) s = s + '}';
      continue;
    }
    break;
  }
  if (parses(s)) return s;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (parses(s)) return s;
    if (!s.startsWith('{')) break;
    let t = s.slice(1);
    if (t.endsWith('}')) t = t.slice(0, -1);
    t = t.replace(/^[\s\n]*/, '').replace(/[\s\n]*$/, '');
    if (!balanceOf(t).ok) break;
    s = t;
  }
  return s;
};
