import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  content: text('content').notNull(),
  chatId: text('chatId').notNull(),
  messageId: text('messageId').notNull(),
  role: text('type', { enum: ['assistant', 'user'] }),
  metadata: text('metadata', {
    mode: 'json',
  }),
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
