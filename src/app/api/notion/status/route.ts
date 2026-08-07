import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getConnection } from '@/lib/connectors/notion/store';
import { getClientCredentials } from '@/lib/connectors/notion/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async () => {
  const connection = getConnection(db);

  // `configured` is only true when every callback prerequisite exists:
  // without NOTION_TOKEN_KEY the callback would fail while encrypting.
  const configured =
    getClientCredentials() !== null && !!process.env.NOTION_TOKEN_KEY;

  return NextResponse.json({
    configured,
    connected: connection !== undefined,
    workspaceId: connection?.workspaceId ?? null,
    workspaceName: connection?.workspaceName ?? null,
  });
};
