import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const sqlite = new Database(path.join(DATA_DIR, './data/db.sqlite'));

/* WAL keeps readers off the writer's lock; the busy timeout stops
   concurrent route handlers from surfacing SQLITE_BUSY to users. */
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');
sqlite.pragma('synchronous = NORMAL');

const db = drizzle(sqlite, {
  schema: schema,
});

export default db;
