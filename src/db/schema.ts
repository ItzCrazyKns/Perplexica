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

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  focusMode: text('focusMode').notNull(),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  chatModelProvider: text('chatModelProvider'),
  chatModel: text('chatModel'),
  embeddingModelProvider: text('embeddingModelProvider'),
  embeddingModel: text('embeddingModel'),
  openAIApiKey: text('openAIApiKey'),
  openAIBaseURL: text('openAIBaseURL'),
  // TODO: add user auth
});