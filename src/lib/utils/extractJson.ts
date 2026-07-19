/**
 * Extract a JSON object string from a model response that may contain
 * reasoning/thinking markers, markdown fences, or other non-JSON boilerplate
 * around the actual JSON payload.
 *
 * Designed to be robust across model families and serving backends, not just
 * the ones it was tested against. Two classes of malformation are handled:
 *
 * 1. Reasoning markers / control tokens before or around the JSON (think
 *    blocks, dangling think tags, llama.cpp control tokens). A naive
 *    repairJson({extractJson:true}) latches onto the first { it finds, which
 *    may sit inside the reasoning and yield invalid JSON.
 *
 * 2. Spurious extra braces for the root object, with or without a matching
 *    counterpart. Confirmed by direct testing against vLLM 0.25 serving
 *    reasoning models with strict json_schema response_format:
 *      - Qwen3.6-35B-small: adjacent "{{" (sometimes a trailing "}}")
 *      - GLM-5.2-MXFP4-A8:  "{\n{" (extra open with a newline, single closer)
 *    Both produce unbalanced JSON. The repair is balance- and parse-driven
 *    (not pattern-based) so it generalizes to adjacent, whitespace-separated,
 *    symmetric, and tripled variants.
 *
 * Token-level malformation (trailing commas, truncation, quote style) is left
 * to the downstream repairJson library, which specializes in those. This util
 * only narrows to the real object and fixes structural brace issues.
 *
 * Idempotent on clean JSON: verified against flat, nested (depths 2-4), and
 * array-valued objects.
 */
export const extractJsonObject = (
  raw: string | null | undefined,
): string => {
  if (!raw) return '{}';

  // Strip common reasoning/thinking wrappers and control tokens.
  let s = raw
    .replace(/<think[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking[\s\S]*?<\/thinking>/gi, '')
    // Remove dangling opening/closing think tags when the model emits only one side.
    .replace(/<\/?(?:think|thinking)>/gi, '')
    // Remove llama.cpp style control tokens.
    .replace(/<\|[^|]*\|>/g, '')
    .trim();

  if (!s) return '{}';

  // Narrow to the first { and drop a trailing markdown fence if the model
  // wrapped the JSON in a ```json ... ``` block.
  const start = s.indexOf('{');
  if (start === -1) return '{}';
  s = s.slice(start).replace(/`{3}\s*$/, '');

  // Pass 1 - balance-driven repair for ASYMMETRIC brace malformation (extra
  // opens without matching closes, or vice versa). Iteratively drop a leading
  // { when opens > closes, or a trailing } when closes > opens, re-checking
  // balance each pass, until the outer object closes.
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
      s = s.replace(/[\s\n]*}\}$/, '');
      if (!s.endsWith('}')) s = s + '}';
      continue;
    }
    break;
  }
  if (parses(s)) return s;

  // Pass 2 - parse-driven repair for SYMMETRIC brace malformation: balanced
  // but structurally invalid (e.g. {{...}} has matching extra open/close but
  // JSON.parse still rejects it). Repeatedly drop one leading { and one
  // trailing } together, only adopting a step if the result still balances,
  // so legitimate nested objects are never corrupted.
  for (let attempt = 0; attempt < 6; attempt++) {
    if (parses(s)) return s;
    if (!s.startsWith('{')) break;
    let t = s.slice(1);
    if (t.endsWith('}')) t = t.slice(0, -1);
    t = t.replace(/^[\s\n]*/, '').replace(/[\s\n]*$/, '');
    if (!balanceOf(t).ok) break;
    s = t;
  }
  if (parses(s)) return s;

  // Unbalanced/unparseable - fall back to the last } so the downstream
  // repairJson has the best chance to close partial JSON (e.g. truncation).
  const end = s.lastIndexOf('}');
  if (end > 0) return s.slice(0, end + 1);
  return s;
};

// Walk the string tracking brace depth, ignoring braces inside JSON strings.
// Returns { ok: true, end } when the outer object closes, otherwise
// { ok: false, depth } where depth > 0 means too many opens, < 0 too many closes.
const balanceOf = (
  s: string,
): { ok: true; end: number } | { ok: false; depth: number } => {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
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
