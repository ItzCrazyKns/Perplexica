import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

// Create SQLite connection
const sqlite = new Database(path.join(process.cwd(), 'data/db.sqlite'));
const db = drizzle(sqlite, {
  schema: schema,
});

// Initialize database schema
(function initializeDatabase() {
  console.log('[DB] Checking database schema...');
  
  try {
    // Check if userPreferences table exists
    const tableExists = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?;
    `).all('userPreferences').length > 0;
    
    if (!tableExists) {
      console.log('[DB] Creating userPreferences table...');
      sqlite.prepare(`
        CREATE TABLE userPreferences (
          id INTEGER PRIMARY KEY,
          userId TEXT NOT NULL UNIQUE,
          categories TEXT DEFAULT '[]' NOT NULL,
          languages TEXT DEFAULT '[]' NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `).run();
      console.log('[DB] userPreferences table created successfully.');
    } else {
      console.log('[DB] userPreferences table already exists.');
    }
  } catch (error) {
    console.error('[DB] Error during database initialization:', error);
  }
})();

export default db;
