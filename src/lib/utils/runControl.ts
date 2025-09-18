// Per-run control registry keyed by messageId
// Provides a soft-stop flag and a retrieval-only AbortController separate from the overall request cancel.

type Entry = {
  softStop: boolean;
  retrievalController?: AbortController;
};

const store: Record<string, Entry> = Object.create(null);

function get(messageId: string): Entry {
  if (!store[messageId]) store[messageId] = { softStop: false };
  return store[messageId];
}

export function registerRetrieval(messageId: string, controller: AbortController) {
  const e = get(messageId);
  e.retrievalController = controller;
}

export function abortRetrieval(messageId: string) {
  const e = store[messageId];
  if (e?.retrievalController && !e.retrievalController.signal.aborted) {
    try {
      e.retrievalController.abort();
    } catch (err) {
      // ignore
    }
  }
}

export function setSoftStop(messageId: string) {
  get(messageId).softStop = true;
}

export function isSoftStop(messageId: string): boolean {
  return !!store[messageId]?.softStop;
}

export function clearSoftStop(messageId: string) {
  if (store[messageId]) store[messageId].softStop = false;
}

export function cleanupRun(messageId: string) {
  if (store[messageId]) delete store[messageId];
}
