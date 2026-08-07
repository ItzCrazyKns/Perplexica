import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { listAuthorizedPages } from '@/lib/connectors/notion/search';
import { deleteConnection } from '@/lib/connectors/notion/store';
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
      // 401 = the stored token is invalid or revoked. It can never work
      // again, so clear the connection — Settings/status then agree it is
      // disconnected and the UI exposes a fresh Connect action.
      if (err.status === 401) {
        deleteConnection(db);
        return NextResponse.json(
          { notConnected: true, message: err.message },
          { status: 409 },
        );
      }
      // 403 = a valid credential that lacks access to the resource — that
      // is NOT a disconnected state; surface it as a real API error.
      return NextResponse.json({ message: err.message }, { status: 502 });
    }
    console.error('Failed to list Notion pages:', err);
    return NextResponse.json(
      { message: 'Failed to list Notion pages' },
      { status: 500 },
    );
  }
};
