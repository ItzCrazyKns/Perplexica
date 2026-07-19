/**
 * Extract a JSON object string from a model response that may contain
 * reasoning/thinking markers, markdown fences, or other non-JSON boilerplate
 * around the actual JSON payload.
 *
 * Two classes of malformation are handled, both confirmed by direct testing
 * against vLLM 0.25 serving reasoning models with strict json_schema
 * response_format (reproduced with Qwen3.6-35B-small and GLM-5.2-MXFP4-A8):
 * the reasoning-marker/control-token case and the spurious-extra-brace case
 * (Qwen emits adjacent "{{"; GLM emits "{\n{" with a single closer). See the
 * repair loop below for details. Idempotent on clean JSON.
 */
export const extractJsonObject = (raw: string | null | undefined): string => {
  if (!raw) return '{}';

  // Strip common reasoning/thinking wrappers.
  let s = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    // Remove dangling opening/closing think tags when the model emits only one side.
    .replace(/<\/?(?:think|thinking)>/gi, '')
    // Remove llama.cpp style control tokens: <|...|>
    .replace(/<\|[^|]*\|>/g, '')
    .trim();

  if (!s) return '{}';

  // Narrow to the first '{' and drop a trailing markdown fence if the model
  // wrapped the JSON in ```json ... ``` (observed with GLM when no
  // response_format is set).
  const start = s.indexOf('{');
  if (start === -1) return '{}';
  s = s.slice(start).replace(/`{3}\s*$/, '');

  // vLLM strict-json_schema decoders sometimes emit a spurious extra brace
  // for the root object with no matching counterpart. Two observed forms,
  // both confirmed against vLLM 0.25:
  //   - Qwen3.6: adjacent "{{" (sometimes a trailing "}}")
  //   - GLM-5.2: "{\n{" (extra open brace separated by a newline, single
  //     closer) — opens=3, closes=2.
  // First collapse exactly-doubled boundary braces (symmetric case), then
  // iteratively drop a leading '{' when opens > closes, or a trailing '}'
  // when closes > opens, until the object balances. Legitimate nested
  // objects start with a single '{' so the collapse leaves them untouched.
  if (s.startsWith('{{')) s = s.slice(1);
  if (s.endsWith('}}')) s = s.slice(0, -1);

  for (let attempt = 0; attempt < 4; attempt++) {
    const balance = balanceOf(s);
    if (balance.ok) return s.slice(0, balance.end + 1);
    if (balance.depth > 0 && s[0] === '{') {
      // Drop the spurious leading brace; skip whitespace to the next '{'.
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

  // Unbalanced — fall back to last '}' so repairJson has a fighting chance.
  const end = s.lastIndexOf('}');
  if (end > 0) return s.slice(0, end + 1);
  return s;
};

// Walk the string tracking brace depth (ignoring braces inside strings).
// Returns { ok: true, end } when the outer object closes, otherwise
// { ok: false, depth } where depth > 0 means too many opens, < 0 too many closes.
const balanceOf = (s: string): { ok: true; end: number } | { ok: false; depth: number } => {
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
