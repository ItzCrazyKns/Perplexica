import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import type { NotionConnectionDb } from './store';
import { upsertConnection } from './store';
import { encryptToken } from './token';

export const TEST_TOKEN_KEY = 'test-token-key-12345';
export const TEST_ACCESS_TOKEN = 'secret_test_access_token_abc123';

/**
 * Builds an in-memory database from the real migration file so tests
 * exercise the actual schema. Note: sets NOTION_TOKEN_KEY as a side
 * effect when creating a connected DB.
 */
export function createDb(): NotionConnectionDb {
  const sqlite = new Database(':memory:');
  const migrationSql = fs.readFileSync(
    path.resolve(process.cwd(), 'drizzle/0003_notion_connections.sql'),
    'utf-8',
  );
  sqlite.exec(
    migrationSql
      .split('--> statement-breakpoint')
      .map((stmt) =>
        stmt
          .split(/\r?\n/)
          .filter((line) => !line.trim().startsWith('-->'))
          .join('\n')
          .trim(),
      )
      .filter(Boolean)
      .join(';\n'),
  );
  return drizzle(sqlite, { schema });
}

export function createConnectedDb(): NotionConnectionDb {
  const db = createDb();
  process.env.NOTION_TOKEN_KEY = TEST_TOKEN_KEY;
  upsertConnection(db, {
    workspaceId: 'ws_test',
    workspaceName: 'Test Workspace',
    encryptedToken: encryptToken(TEST_ACCESS_TOKEN),
  });
  return db;
}
