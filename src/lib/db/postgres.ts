import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './postgres-schema';

// PostgreSQL connection configuration
// Using environment variables for security
const connectionString = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/perplexica';

// Create a connection pool
const pool = new Pool({
  connectionString,
  // Additional pool configuration
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait before timing out when connecting a new client
});

// Create drizzle instance
export const db = drizzle(pool, { schema });

// Export schema for use in queries
export { newsArticles, riskAnalyses, entityMentions } from './postgres-schema';

// Helper function to test database connection
export async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ PostgreSQL connection successful');
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
    return false;
  }
}

// Helper function to initialize tables (if they don't exist)
export async function initializeTables() {
  try {
    // Create news_articles table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS news_articles (
        id SERIAL PRIMARY KEY,
        source VARCHAR(255) NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        url TEXT,
        published_at TIMESTAMP,
        author VARCHAR(255),
        category VARCHAR(100),
        summary TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Create risk_analyses table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS risk_analyses (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        industry VARCHAR(255),
        risk_level VARCHAR(20) NOT NULL,
        risk_score INTEGER NOT NULL,
        categories JSONB NOT NULL,
        factors JSONB NOT NULL,
        recommendations JSONB NOT NULL,
        data_points JSONB,
        concerns JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Create entity_mentions table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entity_mentions (
        id SERIAL PRIMARY KEY,
        article_id INTEGER REFERENCES news_articles(id),
        entity_name VARCHAR(255) NOT NULL,
        entity_type VARCHAR(50),
        mention_context TEXT,
        sentiment VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Create indexes for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_news_articles_source ON news_articles(source);
      CREATE INDEX IF NOT EXISTS idx_news_articles_category ON news_articles(category);
      CREATE INDEX IF NOT EXISTS idx_news_articles_created_at ON news_articles(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_risk_analyses_company_name ON risk_analyses(company_name);
      CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity_name ON entity_mentions(entity_name);
    `);

    console.log('✅ Database tables initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database tables:', error);
    return false;
  }
}