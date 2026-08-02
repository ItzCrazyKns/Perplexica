import db from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/* Liveness/readiness target. Probing / renders the whole home page;
   this answers from the DB handle alone. */
export const GET = async () => {
  try {
    db.get(sql`SELECT 1`);
    return Response.json({ status: 'ok' }, { status: 200 });
  } catch (err) {
    console.error('Health check failed:', err);
    return Response.json({ status: 'error' }, { status: 503 });
  }
};
