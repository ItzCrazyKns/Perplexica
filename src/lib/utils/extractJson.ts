/**
 * Extract a JSON object string from a model response that may contain
 * reasoning/thinking markers or other non-JSON boilerplate around the actual
 * JSON payload.
 *
 * Reasoning models (e.g. deepseek-r1, qwen3, gpt-oss, nemotron) frequently
 * wrap their chain-of-thought in <think>...</think> or <|...|> markers, or
 * embed stray `{` characters inside the reasoning. A naive
 * `repairJson({ extractJson: true })` call latches onto the first `{` it
 * finds, which may sit inside the reasoning block and yield invalid JSON
 * (e.g. `SyntaxError: Expected property name or '}' in JSON at position 1`).
 *
 * This helper strips reasoning markers first, then narrows the text to the
 * outermost balanced `{ ... }` span so the downstream `repairJson` + parse
 * operates only on the real object.
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

  // Some backends (Qwen family under llama.cpp json_schema constrained
  // decoding) emit a doubled opening brace "{{" (and a matching trailing
  // "}}") for the root object. That makes the balance walk below treat the
  // inner '{' as a nested object and never close, so json-repair fails with
  // "Unexpected end of JSON input". Collapse a leading "{{" to "{" and a
  // trailing "}}" to "}" before walking. Only collapses exactly-doubled
  // boundary braces so legitimate nested objects are untouched.
  if (s.startsWith('{{')) s = s.slice(1);
  if (s.endsWith('}}')) s = s.slice(0, -1);

  // Narrow to the outermost balanced object span. Walk from the first '{'
  // and track brace depth (ignoring braces inside strings) to find the
  // matching '}'. Falls back to "first '{' ... last '}'" if the walk fails.
  const start = s.indexOf('{');
  if (start === -1) return '{}';

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
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
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }

  // Unbalanced — fall back to last '}' so repairJson has a fighting chance.
  const end = s.lastIndexOf('}');
  if (end > start) return s.slice(start, end + 1);
  return s.slice(start);
};
