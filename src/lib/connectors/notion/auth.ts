import type { NotionConnectionDb } from './store';
import { getConnection } from './store';
import { decryptToken } from './token';

/**
 * Resolves the decrypted Notion access token for the instance's
 * connection. Returns null when no connection exists; throws when the
 * stored token cannot be decrypted (e.g. the encryption key changed).
 */

export class NotionNotConnectedError extends Error {}

export function getAccessToken(db: NotionConnectionDb): string | null {
  const connection = getConnection(db);
  if (!connection) return null;

  try {
    return decryptToken(connection.encryptedToken);
  } catch {
    throw new NotionNotConnectedError(
      'Stored Notion token cannot be decrypted (NOTION_TOKEN_KEY may have changed)',
    );
  }
}
