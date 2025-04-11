import db from './index';
import { userPreferences } from './schema';
import { sql } from 'drizzle-orm';

/**
 * Run database migrations to ensure schema is up to date.
 * This is designed to run once at application startup.
 */
export async function runMigrations() {
  console.log('[DB Migration] Checking database schema...');
  
  try {
    // Check if userPreferences table exists
    const tableExists = await checkIfTableExists('userPreferences');
    
    if (!tableExists) {
      console.log('[DB Migration] Creating userPreferences table...');
      await createUserPreferencesTable();
      console.log('[DB Migration] userPreferences table created successfully.');
    } else {
      console.log('[DB Migration] userPreferences table already exists.');
    }
    
    console.log('[DB Migration] Database schema is up to date.');
  } catch (error) {
    console.error('[DB Migration] Error during migration:', error);
    // Don't throw the error - we want the application to continue even if migration fails
  }
}

/**
 * Check if a table exists in the database
 */
async function checkIfTableExists(tableName: string): Promise<boolean> {
  const result = db.$client.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name=?;
  `).all(tableName);
  
  return result.length > 0;
}

/**
 * Create the userPreferences table using the schema definition
 */
async function createUserPreferencesTable() {
  // Create the table using a raw SQL query based on our schema
  db.$client.prepare(`
    CREATE TABLE userPreferences (
      id INTEGER PRIMARY KEY,
      userId TEXT NOT NULL UNIQUE,
      categories TEXT DEFAULT '[]' NOT NULL,
      languages TEXT DEFAULT '[]' NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `).run();
}

// Run migrations automatically when this module is imported
runMigrations();
