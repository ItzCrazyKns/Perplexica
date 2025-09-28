/**
 * Utility helpers for manipulating <ToolCall ...> markup blocks in streamed / persisted message content.
 * These functions are isomorphic (no DOM dependencies) so they can be used in both
 * the Next.js API route (Node) and frontend React (browser) code.
 */

/** Escape an attribute value for safe inclusion inside double quotes. */
export function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface UpdateToolCallOptions {
  status: string; // running | success | error
  error?: string;
  extra?: Record<string, string | undefined>;
}

/**
 * Update (mutate) a single <ToolCall ... toolCallId="ID" ...> opening tag inside `content`.
 * - Rewrites / injects status attribute
 * - Adds or removes error attribute
 * - Preserves order preference for core attributes (type, toolCallId, status, query, count, url, videoId, error)
 */
export function updateToolCallMarkup(
  content: string,
  toolCallId: string,
  { status, error, extra }: UpdateToolCallOptions,
): string {
  if (!content || !toolCallId) return content;
  const idEscaped = toolCallId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const openTagRegex = new RegExp(
    `<ToolCall[^>]*toolCallId=\"${idEscaped}\"[^>]*>`,
    'i',
  );
  const match = content.match(openTagRegex);
  if (!match) return content;

  const originalTag = match[0];
  const attrPart = originalTag
    .replace(/^<ToolCall/i, '')
    .replace(/>$/, '')
    .trim();

  const attrRegex = /([a-zA-Z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;
  const attrs: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(attrPart))) {
    attrs[m[1]] = m[2];
  }

  // Apply mutations
  attrs.status = status;
  if (error) {
    attrs.error = escapeAttribute(error.slice(0, 300));
  } else if (status === 'success') {
    delete attrs.error; // Clean up stale error when transitioning to success
  }

  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (typeof v === 'string' && v.length > 0) {
        attrs[k] = escapeAttribute(v.slice(0, 500));
      }
    }
  }

  const orderedKeys = [
    'type',
    'toolCallId',
    'status',
    'query',
    'count',
    'url',
    'videoId',
    'error',
    ...Object.keys(attrs).filter(
      (k) =>
        ![
          'type',
          'toolCallId',
          'status',
          'query',
          'count',
          'url',
          'videoId',
          'error',
        ].includes(k),
    ),
  ].filter((k, i, arr) => attrs[k] !== undefined && arr.indexOf(k) === i);

  const newTag = `<ToolCall ${orderedKeys
    .map((k) => `${k}="${attrs[k]}"`)
    .join(' ')}>`;

  return content.replace(originalTag, newTag);
}

/** Convenience wrapper to bulk-update multiple tool calls (used if ever needed). */
export function updateMultipleToolCalls(
  content: string,
  updates: { toolCallId: string; status: string; error?: string; extra?: Record<string, string | undefined> }[],
): string {
  return updates.reduce(
    (acc, u) => updateToolCallMarkup(acc, u.toolCallId, u),
    content,
  );
}
