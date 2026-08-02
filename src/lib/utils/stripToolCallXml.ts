/*
 * The writer has no tools, but models that know a tool-call syntax
 * from their chat template sometimes emit it anyway; the XML then
 * streams into the answer, where markdown rendering hides the tags
 * and shows the arguments as garbage. Strip whole tool-call spans
 * from the stream; hold back a possible partial opening tag until
 * the next chunk decides it.
 */

const SPANS: { open: string; close: string }[] = [
  { open: '<tool_call>', close: '</tool_call>' },
  { open: '<function=', close: '</function>' },
];

export const createToolCallXmlFilter = () => {
  let held = '';
  let inside: { close: string } | null = null;

  const longestOpen = Math.max(...SPANS.map((s) => s.open.length));

  const isPartialOpen = (tail: string): boolean =>
    SPANS.some((s) => s.open.startsWith(tail));

  const process = (chunk: string, flush: boolean): string => {
    let buf = held + chunk;
    held = '';
    let out = '';

    while (buf.length > 0) {
      if (inside) {
        const end = buf.indexOf(inside.close);
        if (end === -1) {
          /* Keep a tail in case the closing tag is split. */
          if (!flush) held = buf.slice(-inside.close.length + 1 || 0);
          buf = '';
        } else {
          buf = buf.slice(end + inside.close.length);
          inside = null;
        }
        continue;
      }

      const opens = SPANS.map((s) => ({ s, at: buf.indexOf(s.open) })).filter(
        (o) => o.at !== -1,
      );

      if (opens.length > 0) {
        const first = opens.reduce((a, b) => (a.at <= b.at ? a : b));
        out += buf.slice(0, first.at);
        buf = buf.slice(first.at + first.s.open.length);
        inside = { close: first.s.close };
        continue;
      }

      /* No opener: emit everything except a tail that might be the
         start of one arriving split across chunks. */
      if (!flush) {
        for (
          let keep = Math.min(longestOpen - 1, buf.length);
          keep > 0;
          keep--
        ) {
          const tail = buf.slice(-keep);
          if (isPartialOpen(tail)) {
            held = tail;
            buf = buf.slice(0, -keep);
            break;
          }
        }
      }

      out += buf;
      buf = '';
    }

    return out;
  };

  return {
    write: (chunk: string) => process(chunk, false),
    /* Unclosed tool-call spans are dropped; held plain text is
       released. */
    flush: () => (inside ? '' : process('', true)),
  };
};
