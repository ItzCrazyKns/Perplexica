import { NextRequest } from 'next/server';

// In-memory map to store cancel tokens by messageId
const cancelTokens: Record<string, AbortController> = {};

// Export for use in chat/route.ts
export function registerCancelToken(
  messageId: string,
  controller: AbortController,
) {
  cancelTokens[messageId] = controller;
}

export function cleanupCancelToken(messageId: string) {
  var cancelled = false;
  if (messageId in cancelTokens) {
    delete cancelTokens[messageId];
    cancelled = true;
  }
  return cancelled;
}

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

export async function POST(req: NextRequest) {
  const { messageId } = await req.json();
  if (!messageId) {
    return Response.json({ error: 'Missing messageId' }, { status: 400 });
  }
  const cancelled = cancelRequest(messageId);
  if (cancelled) {
    return Response.json({ success: true });
  } else {
    return Response.json(
      { error: 'No in-progress request for this messageId' },
      { status: 404 },
    );
  }
}
