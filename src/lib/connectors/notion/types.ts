/**
 * Domain types for the Notion Connection.
 *
 * The connection is instance-level and single-row: one OAuth-authorized
 * workspace per Vane instance. Access to any page is granted separately,
 * per conversation, never by the connection alone.
 */

export interface NotionConnection {
  id: number;
  workspaceId: string;
  workspaceName: string;
  /** Encrypted at rest; never logged. */
  encryptedToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertNotionConnection {
  workspaceId: string;
  workspaceName: string;
  encryptedToken: string;
}

/** A page or database the workspace owner shared with the connection. */
export interface AuthorizedPage {
  id: string;
  title: string;
  type: 'page' | 'database';
}
