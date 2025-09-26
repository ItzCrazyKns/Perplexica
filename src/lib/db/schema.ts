import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { Document } from 'langchain/document';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  role: text('type', { enum: ['assistant', 'user', 'source'] }).notNull(),
  chatId: text('chatId').notNull(),
  createdAt: text('createdAt')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  messageId: text('messageId').notNull(),

  content: text('content'),

  sources: text('sources', {
    mode: 'json',
  })
    .$type<Document[]>()
    .default(sql`'[]'`),
});

interface File {
  name: string;
  fileId: string;
}

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  focusMode: text('focusMode').notNull(),
  files: text('files', { mode: 'json' })
    .$type<File[]>()
    .default(sql`'[]'`),
});

export const userMemories = sqliteTable('user_memories', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  memoryType: text('memoryType', { enum: ['user', 'session', 'chat'] }).notNull(),
  mem0Id: text('mem0Id'), // Reference to mem0 memory ID
  memory: text('memory').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  chatId: text('chatId'), // Link to specific chat if applicable
  sessionId: text('sessionId'), // Link to specific session if applicable
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt'),
  expiresAt: text('expiresAt'), // For session memories
});

export const memoryStats = sqliteTable('memory_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull(),
  totalMemories: integer('totalMemories').notNull().default(0),
  userMemories: integer('userMemories').notNull().default(0),
  sessionMemories: integer('sessionMemories').notNull().default(0),
  chatMemories: integer('chatMemories').notNull().default(0),
  lastCleanup: text('lastCleanup'),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});

export const memorySettings = sqliteTable('memory_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('userId').notNull().unique(),
  memoryEnabled: integer('memoryEnabled', { mode: 'boolean' }).notNull().default(true),
  retentionDays: integer('retentionDays').notNull().default(365),
  maxMemories: integer('maxMemories').notNull().default(10000),
  autoCleanup: integer('autoCleanup', { mode: 'boolean' }).notNull().default(true),
  privacyLevel: text('privacyLevel', { enum: ['high', 'medium', 'low'] }).notNull().default('medium'),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});
