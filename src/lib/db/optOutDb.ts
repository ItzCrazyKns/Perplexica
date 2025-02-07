import { Database } from 'better-sqlite3';
import path from 'path';

interface OptOutEntry {
  domain: string;
  email: string;
  reason?: string;
  timestamp: Date;
}

export class OptOutDatabase {
  private db: Database;

  constructor() {
    this.db = new Database(path.join(__dirname, '../../../data/optout.db'));
    this.initializeDatabase();
  }

  private initializeDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS opt_outs (
        domain TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        reason TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_domain ON opt_outs(domain);
    `);
  }

  async addOptOut(entry: OptOutEntry): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO opt_outs (domain, email, reason, timestamp) VALUES (?, ?, ?, ?)'
    );
    stmt.run(entry.domain, entry.email, entry.reason, entry.timestamp.toISOString());
  }

  isOptedOut(domain: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM opt_outs WHERE domain = ?');
    return stmt.get(domain) !== undefined;
  }

  removeOptOut(domain: string): void {
    const stmt = this.db.prepare('DELETE FROM opt_outs WHERE domain = ?');
    stmt.run(domain);
  }

  getOptOutList(): OptOutEntry[] {
    return this.db.prepare('SELECT * FROM opt_outs').all();
  }
} 