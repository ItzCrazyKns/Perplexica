import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { deleteConnection } from '@/lib/connectors/notion/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = async () => {
  deleteConnection(db);
  return NextResponse.json({ connected: false });
};
