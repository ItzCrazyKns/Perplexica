/*
 * An LLM stream that stalls mid-answer otherwise blocks forever: the
 * research budget bounds iterations, not a hung call, and the client
 * spinner sits until the session TTL. Raising here routes the failure
 * through the agent's normal error path instead.
 */
export async function* withInactivityTimeout<T>(
  source: AsyncIterable<T>,
  ms: number,
  label: string,
): AsyncGenerator<T> {
  const it = source[Symbol.asyncIterator]();

  while (true) {
    let timer: NodeJS.Timeout | undefined;

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `${label} produced no output for ${ms / 1000}s, aborting`,
            ),
          ),
        ms,
      );
      timer.unref?.();
    });

    try {
      const res = await Promise.race([it.next(), timeout]);
      if (res.done) return;
      yield res.value;
    } catch (err) {
      it.return?.(undefined)?.catch?.(() => {});
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
