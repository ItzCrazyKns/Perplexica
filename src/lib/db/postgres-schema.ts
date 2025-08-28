import { pgTable, serial, text, timestamp, jsonb, varchar, integer } from 'drizzle-orm/pg-core';

// News articles table - following Boston's database/init.sql structure
export const newsArticles = pgTable('news_articles', {
  id: serial('id').primaryKey(),
  source: varchar('source', { length: 255 }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  url: text('url'),
  publishedAt: timestamp('published_at'),
  author: varchar('author', { length: 255 }),
  category: varchar('category', { length: 100 }),
  summary: text('summary'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Risk analyses table for persisting risk analysis results
export const riskAnalyses = pgTable('risk_analyses', {
  id: serial('id').primaryKey(),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  industry: varchar('industry', { length: 255 }),
  riskLevel: varchar('risk_level', { length: 20 }).notNull(),
  riskScore: integer('risk_score').notNull(),
  categories: jsonb('categories').notNull(),
  factors: jsonb('factors').notNull(),
  recommendations: jsonb('recommendations').notNull(),
  dataPoints: jsonb('data_points'),
  concerns: jsonb('concerns'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Entity mentions table for tracking entities found in news
export const entityMentions = pgTable('entity_mentions', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').references(() => newsArticles.id),
  entityName: varchar('entity_name', { length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }), // company, person, location, etc.
  mentionContext: text('mention_context'),
  sentiment: varchar('sentiment', { length: 20 }), // positive, negative, neutral
  createdAt: timestamp('created_at').defaultNow().notNull(),
});