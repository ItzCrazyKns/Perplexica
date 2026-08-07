import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { notionConnections } from '@/lib/db/schema';
import type { NotionConnection, UpsertNotionConnection } from './types';

/**
 * Persistence for the Notion Connection.
 *
 * The store guarantees a single connection row per instance: upserting
 * updates the existing row in place. Functions take the database as an
 * argument (dependency injection) so tests can run against an in-memory
 * SQLite database.
 */

export type NotionConnectionDb = BetterSQLite3Database<typeof schema>;

export const getConnection = (
  db: NotionConnectionDb,
): NotionConnection | undefined => {
  return db.select().from(notionConnections).limit(1).get();
};

export const upsertConnection = (
  db: NotionConnectionDb,
  input: UpsertNotionConnection,
): NotionConnection => {
  const now = new Date().toISOString();

  // Conflict-safe: the `singleton` unique index (migration 0005) turns
  // a second insert into an update, so concurrent OAuth flows can never
  // create a second connection row.
  db.insert(notionConnections)
    .values({
      workspaceId: input.workspaceId,
      workspaceName: input.workspaceName,
      encryptedToken: input.encryptedToken,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: notionConnections.singleton,
      set: {
        workspaceId: input.workspaceId,
        workspaceName: input.workspaceName,
        encryptedToken: input.encryptedToken,
        updatedAt: now,
      },
    })
    .run();

  return getConnection(db)!;
};

export const deleteConnection = (db: NotionConnectionDb): boolean => {
  const existing = getConnection(db);
  if (!existing) return false;

  db.delete(notionConnections)
    .where(eq(notionConnections.id, existing.id))
    .run();

  return true;
};
