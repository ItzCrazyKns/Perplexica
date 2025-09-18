import { NextRequest } from 'next/server';
import { setSoftStop, abortRetrieval } from '@/lib/utils/runControl';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messageId = body?.messageId as string | undefined;
    if (!messageId || typeof messageId !== 'string') {
      return Response.json({ error: 'Missing messageId' }, { status: 400 });
    }
    setSoftStop(messageId);
    abortRetrieval(messageId);
    return Response.json({ success: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Bad Request' }, { status: 400 });
  }
}
