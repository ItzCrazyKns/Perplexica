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
  // can put a stray { in front of the real one, which would mislead the
  // brace-balance walk below. But the same literal text can legitimately
  // appear *inside* JSON string values (a field whose content discusses
  // markup, or model-emitted control-token sentinels the caller wants
  // preserved). Stripping across the whole string would silently alter that
  // content, so we strip only the leading pre-JSON segment — everything up to
  // (but not including) the first { — and leave the JSON body untouched.
  const firstBrace = raw.indexOf('{');
  if (firstBrace === -1) return '{}';
  const cleanedPrefix = raw
    .slice(0, firstBrace)
    .replace(/<think[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking[\s\S]*?<\/thinking>/gi, '')
    .replace(/<\/?(?:think|thinking)>/gi, '')
    .replace(/<\|[^|]*\|>/g, '');
  // Re-locate the first { on the combined cleaned prefix + original body: an
  // unclosed marker that bleeds across the original first { is removed from
  // the prefix, shifting the object start. Anything before the object —
  // markers or prose — is discarded; the JSON body is kept verbatim.
  let s = (cleanedPrefix + raw.slice(firstBrace)).trim();
  if (!s) return '{}';
  const braceStart = s.indexOf('{');
  if (braceStart === -1) return '{}';
  s = s.slice(braceStart);

  s = repairSpuriousBraces(s);

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
