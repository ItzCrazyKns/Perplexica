/*
 * Reads a newline-delimited JSON stream.
 *
 * Only the trailing fragment is carried to the next chunk: the earlier
 * version reset its buffer only on a successful parse, so a chunk that
 * ended mid-object replayed every line it contained on the next read.
 */
export const readNdjsonStream = async (
  body: ReadableStream<Uint8Array>,
  onMessage: (data: any) => void,
): Promise<void> => {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');

  let buffer = '';

  const flush = (line: string) => {
    if (!line.trim()) return;

    try {
      onMessage(JSON.parse(line));
    } catch {
      console.warn('Skipping malformed stream line');
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    lines.forEach(flush);
  }

  flush(buffer);
};
