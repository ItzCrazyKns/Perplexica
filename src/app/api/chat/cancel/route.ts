import { NextRequest } from 'next/server';
import { cancelRequest } from '@/lib/cancel-tokens';

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
