/**
 * Notion connector — the single access point for the Notion API.
 *
 * Everything Notion-related flows through this module (ADR-0004): the UI
 * reaches it only via Vane API routes, the agent only via thin tool
 * adapters. The UI never calls the Notion API directly.
 */

export * from './types';
export { encryptToken, decryptToken, NotionTokenError } from './token';
export {
  getConnection,
  upsertConnection,
  deleteConnection,
  type NotionConnectionDb,
} from './store';
