import SessionManager from './session';

/*
 * NDJSON stream of a session's events.
 *
 * Writes are chained rather than fired and forgotten so a slow client
 * applies backpressure, and close is idempotent because abort races
 * the end and error events.
 */
export const createSessionStream = (
  session: SessionManager,
  signal: AbortSignal,
): Response => {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  let writeQueue: Promise<void> = Promise.resolve();
  let closed = false;

  const send = (payload: unknown) => {
    if (closed) return;
    writeQueue = writeQueue
      .then(() => writer.write(encoder.encode(JSON.stringify(payload) + '\n')))
      .catch(() => {
        closed = true;
      });
  };

  const close = () => {
    if (closed) return;
    closed = true;
    writeQueue = writeQueue.then(() => writer.close()).catch(() => undefined);
  };

  /* Assigned before subscribe returns: subscribe replays past events
     synchronously, so the handler can run during this call. */
  let disconnect: () => void = () => undefined;

  disconnect = session.subscribe((event: string, data: any) => {
    if (event === 'data') {
      if (data.type === 'block') {
        send({ type: 'block', block: data.block });
      } else if (data.type === 'appendText') {
        send({ type: 'appendText', blockId: data.blockId, delta: data.delta });
      } else if (data.type === 'updateBlock') {
        send({ type: 'updateBlock', blockId: data.blockId, patch: data.patch });
      } else if (data.type === 'researchComplete') {
        send({ type: 'researchComplete' });
      }
    } else if (event === 'end') {
      send({ type: 'messageEnd' });
      close();
      disconnect();
    } else if (event === 'error') {
      send({ type: 'error', data: data.data });
      close();
      disconnect();
    }
  });

  signal.addEventListener('abort', () => {
    disconnect();
    close();
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
};
