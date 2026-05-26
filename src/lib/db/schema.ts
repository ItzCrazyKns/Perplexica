import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { Block } from '../types';
import { SearchSources } from '../agents/search/types';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  messageId: text('messageId').notNull(),
  chatId: text('chatId').notNull(),
  backendId: text('backendId').notNull(),
  query: text('query').notNull(),
  createdAt: text('createdAt').notNull(),
  responseBlocks: text('responseBlocks', { mode: 'json' })
    .$type<Block[]>()
    .default(sql`'[]'`),
  status: text({ enum: ['answering', 'completed', 'error'] }).default(
    'answering',
  ),
});

interface DBFile {
  name: string;
  fileId: string;
}

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  sources: text('sources', {
    mode: 'json',
  })
    .$type<SearchSources[]>()
    .default(sql`'[]'`),
  files: text('files', { mode: 'json' })
    .$type<DBFile[]>()
    .default(sql`'[]'`),
});

export const priorartWorkspaces = sqliteTable('priorart_workspaces', {
  id: text('id').primaryKey(),
  featureId: text('featureId').notNull(),
  title: text('title').notNull(),
  priorityDate: text('priorityDate').notNull(),
  claimText: text('claimText'),
  status: text({ enum: ['running', 'completed', 'error'] }).default('running'),
  createdAt: text('createdAt').notNull(),
  markdownPath: text('markdownPath'),
  jsonPath: text('jsonPath'),
  claimChartPath: text('claimChartPath'),
  warnings: text('warnings', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  lastStep: text('lastStep'),
  progress: integer('progress').default(0),
  errorMessage: text('errorMessage'),
  lastUpdatedAt: text('lastUpdatedAt'),
});

export const priorartDocuments = sqliteTable('priorart_documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: text('workspaceId').notNull(),
  publicationNumber: text('publicationNumber').notNull(),
  title: text('title'),
  source: text({ enum: ['uspto_odp', 'bigquery_patents'] }).notNull(),
  fusedScore: text('fusedScore'),
  json: text('json', { mode: 'json' }).$type<Record<string, unknown>>(),
});
