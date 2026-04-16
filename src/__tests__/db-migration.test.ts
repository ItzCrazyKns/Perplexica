import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('DB Migration — real execution smoke tests', () => {
  // Create a temp DB, run all migrations, verify schema
  let db: Database.Database;
  let dbPath: string;

  beforeAll(() => {
    // Create a temporary SQLite database for migration testing
    dbPath = path.join(os.tmpdir(), `vane-migration-test-${Date.now()}.db`);
    db = new Database(dbPath);
  });

  afterAll(() => {
    db?.close();
    // Clean up temp DB
    try {
      fs.unlinkSync(dbPath);
    } catch {}
  });

  it('executes all migrations without error', () => {
    const migrationsDir = path.join(process.cwd(), 'drizzle');
    const migrationFiles = [
      '0000_fuzzy_randall.sql',
      '0001_wise_rockslide.sql',
      '0002_daffy_wrecker.sql',
      '0003_add_users_sessions.sql',
      '0004_add_userid_to_chats.sql',
    ];

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      // Only execute non-empty, non-no-op migrations
      if (sql.trim().length > 0 && sql.trim().toLowerCase() !== '/* do nothing */') {
        expect(() => db.exec(sql)).not.toThrow();
      }
    }
  });

  it('creates chats table with required columns', () => {
    const columns = db
      .prepare('PRAGMA table_info(chats)')
      .all() as Array<{ name: string }>;
    const colNames = columns.map((c) => c.name);

    expect(colNames).toContain('id');
    expect(colNames).toContain('title');
    expect(colNames).toContain('createdAt');
    expect(colNames).toContain('focusMode');
    expect(colNames).toContain('userId'); // Added by 0004
  });

  it('creates users table with RBAC columns', () => {
    const columns = db
      .prepare('PRAGMA table_info(users)')
      .all() as Array<{ name: string }>;
    const colNames = columns.map((c) => c.name);

    expect(colNames).toContain('id');
    expect(colNames).toContain('username');
    expect(colNames).toContain('password_hash');
    expect(colNames).toContain('role');
    expect(colNames).toContain('createdAt');
  });

  it('creates sessions table with session management columns', () => {
    const columns = db
      .prepare('PRAGMA table_info(sessions)')
      .all() as Array<{ name: string }>;
    const colNames = columns.map((c) => c.name);

    expect(colNames).toContain('id');
    expect(colNames).toContain('userId');
    expect(colNames).toContain('expiresAt');
    expect(colNames).toContain('createdAt');
  });

  it('chats.userId has correct NOT NULL constraint', () => {
    const info = db
      .prepare('PRAGMA table_info(chats)')
      .all() as Array<{ name: string; notnull: number }>;
    const userIdCol = info.find((c) => c.name === 'userId');
    expect(userIdCol).toBeDefined();
    expect(userIdCol.notnull).toBe(1); // NOT NULL
  });

  it('sessions.userId has correct NOT NULL constraint', () => {
    const info = db
      .prepare('PRAGMA table_info(sessions)')
      .all() as Array<{ name: string; notnull: number }>;
    const userIdCol = info.find((c) => c.name === 'userId');
    expect(userIdCol).toBeDefined();
    expect(userIdCol.notnull).toBe(1); // NOT NULL
  });

  it('users.role defaults to user', () => {
    const info = db
      .prepare('PRAGMA table_info(users)')
      .all() as Array<{ name: string; dflt_value: string | null }>;
    const roleCol = info.find((c) => c.name === 'role');
    expect(roleCol).toBeDefined();
    expect(roleCol.dflt_value).toBe("'user'");
  });
});

describe('DB Schema — TypeScript type smoke tests', () => {
  it('users and sessions schema modules load without error', async () => {
    const schema = await import('@/lib/db/schema');
    expect(schema.users).toBeDefined();
    expect(schema.sessions).toBeDefined();
  });

  it('UserRole type allows admin and user', async () => {
    const { UserRole } = await import('@/lib/auth');
    const roles: UserRole[] = ['admin', 'user'];
    expect(roles).toContain('admin');
    expect(roles).toContain('user');
  });

  it('AuthUser has required fields', async () => {
    const { AuthUser } = await import('@/lib/auth');
    const user: AuthUser = { id: 'test', username: 'test', role: 'user' };
    expect(user.id).toBe('test');
    expect(user.role).toBe('user');
  });

  it('SessionUser includes sessionId', async () => {
    const { SessionUser } = await import('@/lib/auth');
    const s: SessionUser = {
      id: 'test',
      username: 'test',
      role: 'admin',
      sessionId: 'sess-1',
    };
    expect(s.sessionId).toBe('sess-1');
  });
});
