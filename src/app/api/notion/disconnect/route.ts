import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { deleteConnection } from '@/lib/connectors/notion/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Same-origin check: a cross-site form POST must not be able to drop the
 * user's Notion connection. Browsers send an Origin (or Referer) header
 * on POST; reject requests from other origins or non-browser clients.
 * Note: behind a reverse proxy `req.url` may differ from the browser
 * Origin — if that mis-triggers a 403, allow-list the public origin.
 */
const isSameOrigin = (req: Request): boolean => {
  const origin = req.headers.get('origin') || req.headers.get('referer');
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
};

export const POST = async (req: Request) => {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  deleteConnection(db);
  return NextResponse.json({ connected: false });
};
