export {};

// In-memory map to store cancel tokens by messageId
const cancelTokens: Record<string, AbortController> = {};

// Register a cancel token for a message ID
export function registerCancelToken(
  messageId: string,
  controller: AbortController,
) {
  cancelTokens[messageId] = controller;
}

// Remove a cancel token from the map
export function cleanupCancelToken(messageId: string) {
  var cancelled = false;
  if (messageId in cancelTokens) {
    delete cancelTokens[messageId];
    cancelled = true;
  }
  return cancelled;
}

// Cancel a request by its message ID
export function cancelRequest(messageId: string) {
  const controller = cancelTokens[messageId];
  if (controller) {
    try {
      controller.abort();
    } catch (e) {
      console.error(`Error aborting request for messageId ${messageId}:`, e);
    }
    return true;
  }
  return false;
}
