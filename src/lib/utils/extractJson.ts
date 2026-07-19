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

  // Strip reasoning/control tokens that could put a stray { before the real
  // object (which would mislead the brace-balance walk below).
  let s = raw
    .replace(/<think[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking[\s\S]*?<\/thinking>/gi, '')
    .replace(/<\/?(?:think|thinking)>/gi, '')
    .replace(/<\|[^|]*\|>/g, '')
    .trim();
  if (!s) return '{}';

  const firstBrace = s.indexOf('{');
  if (firstBrace === -1) return '{}';
  s = s.slice(firstBrace);

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
const balanceOf = (
  s: string,
): { ok: true; end: number } | { ok: false; depth: number } => {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
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
