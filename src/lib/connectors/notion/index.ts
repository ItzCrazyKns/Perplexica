/**
 * Notion connector — the single access point for the Notion API.
 *
 * Everything Notion-related flows through this module (ADR-0004): the UI
 * reaches it only via Vane API routes, the agent only via thin tool
 * adapters. The UI never calls the Notion API directly.
 */

export * from './types';
export { encryptToken, decryptToken, NotionTokenError } from './token';
export { NotionNotConnectedError, getAccessToken } from './auth';
export {
  getConnection,
  upsertConnection,
  deleteConnection,
  type NotionConnectionDb,
} from './store';
export {
  NOTION_API_BASE,
  NOTION_API_VERSION,
  NotionApiError,
  request,
} from './client';
export {
  listAuthorizedPages,
  searchNotionPages,
  fuzzyMatchPages,
} from './search';
export { getPageMarkdown } from './pages';
export { queryDatabase, type DatabaseEntry } from './databases';
