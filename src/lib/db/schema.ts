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

// Add user preferences table for Discover features
export const userPreferences = sqliteTable('userPreferences', {
  id: integer('id').primaryKey(),
  userId: text('userId').notNull().unique(),
  categories: text('categories', { mode: 'json' })
    .$type<string[]>()
    .default(sql`'[]'`), // Categories will be set at the application level
  languages: text('languages', { mode: 'json' })
    .$type<string[]>()
    .default(sql`'[]'`), // Languages will be set at the application level
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});
