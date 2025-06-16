import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql } from '@vercel/postgres';
import * as schema from './schema';

// Create a PostgreSQL client using Vercel Postgres
const db = drizzle(sql, {
  schema: schema,
});

export default db;
