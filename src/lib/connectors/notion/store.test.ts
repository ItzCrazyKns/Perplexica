import { describe, it, expect, beforeEach } from 'vitest';
import { notionConnections } from '@/lib/db/schema';
import {
  getConnection,
  upsertConnection,
  deleteConnection,
  type NotionConnectionDb,
} from './store';
import { createDb } from './test-utils';

describe('connection store', () => {
  let db: NotionConnectionDb;

  beforeEach(() => {
    db = createDb();
  });

  it('returns undefined when no connection exists', () => {
    expect(getConnection(db)).toBeUndefined();
  });

  it('upserts a connection and reads it back', () => {
    upsertConnection(db, {
      workspaceId: 'ws_1',
      workspaceName: 'My Workspace',
      encryptedToken: 'v1.encrypted',
    });

    const connection = getConnection(db)!;
    expect(connection.workspaceId).toBe('ws_1');
    expect(connection.workspaceName).toBe('My Workspace');
    expect(connection.encryptedToken).toBe('v1.encrypted');
    expect(connection.createdAt).toBeTruthy();
    expect(connection.updatedAt).toBeTruthy();
  });

  it('keeps a single row across upserts (updates in place)', () => {
    upsertConnection(db, {
      workspaceId: 'ws_1',
      workspaceName: 'First Name',
      encryptedToken: 'v1.a',
    });
    upsertConnection(db, {
      workspaceId: 'ws_2',
      workspaceName: 'Renamed Workspace',
      encryptedToken: 'v1.b',
    });

    const rows = db.select().from(notionConnections).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].workspaceId).toBe('ws_2');
    expect(rows[0].workspaceName).toBe('Renamed Workspace');
    expect(rows[0].encryptedToken).toBe('v1.b');
  });

  it('deletes the connection and reports success', () => {
    upsertConnection(db, {
      workspaceId: 'ws_1',
      workspaceName: 'My Workspace',
      encryptedToken: 'v1.encrypted',
    });

    expect(deleteConnection(db)).toBe(true);
    expect(getConnection(db)).toBeUndefined();
    expect(deleteConnection(db)).toBe(false);
  });
});
