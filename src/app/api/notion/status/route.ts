import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getConnection } from '@/lib/connectors/notion/store';
import { getClientCredentials } from '@/lib/connectors/notion/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async () => {
  const connection = getConnection(db);

  return NextResponse.json({
    configured: getClientCredentials() !== null,
    connected: connection !== undefined,
    workspaceId: connection?.workspaceId ?? null,
    workspaceName: connection?.workspaceName ?? null,
  });
};
