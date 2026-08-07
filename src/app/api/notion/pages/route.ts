import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { listAuthorizedPages } from '@/lib/connectors/notion/search';
import { NotionNotConnectedError } from '@/lib/connectors/notion/auth';
import { NotionApiError } from '@/lib/connectors/notion/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async () => {
  try {
    const pages = await listAuthorizedPages(db);
    return NextResponse.json({ pages });
  } catch (err) {
    if (err instanceof NotionNotConnectedError) {
      return NextResponse.json(
        { notConnected: true, message: err.message },
        { status: 409 },
      );
    }
    if (err instanceof NotionApiError) {
      // 401/403 means the stored token is bad or revoked — the UI treats
      // this as disconnected so the user gets a clear reconnect path.
      if (err.status === 401 || err.status === 403) {
        return NextResponse.json(
          { notConnected: true, message: err.message },
          { status: 409 },
        );
      }
      return NextResponse.json({ message: err.message }, { status: 502 });
    }
    console.error('Failed to list Notion pages:', err);
    return NextResponse.json(
      { message: 'Failed to list Notion pages' },
      { status: 500 },
    );
  }
};
