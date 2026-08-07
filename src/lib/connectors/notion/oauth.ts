import { NOTION_API_VERSION } from './client';

/**
 * Notion OAuth 2.0 (authorization code flow).
 *
 * The token is never hardcoded (see ADR-0002): the client id/secret come
 * from env vars, and the resulting access token is encrypted before it
 * is stored by the connection store.
 */

export interface ClientCredentials {
  clientId: string;
  clientSecret: string;
}

export interface TokenExchangeResult {
  accessToken: string;
  workspaceId: string;
  workspaceName: string;
}

export class NotionOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotionOAuthError';
  }
}

export function getClientCredentials(): ClientCredentials | null {
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function buildAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL('https://api.notion.com/v1/oauth/authorize');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('owner', 'user');
  url.searchParams.set('state', input.state);
  return url.toString();
}

export async function exchangeCodeForToken(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<TokenExchangeResult> {
  const res = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${input.clientId}:${input.clientSecret}`,
      ).toString('base64')}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  });

  if (!res.ok) {
    let message = `Notion OAuth token exchange failed (${res.status})`;
    try {
      const payload = (await res.json()) as {
        error?: string;
        error_description?: string;
      };
      if (payload.error) {
        message = `${payload.error}: ${payload.error_description ?? 'unknown error'}`;
      }
    } catch {
      // Non-JSON error body; keep the default message.
    }
    throw new NotionOAuthError(message);
  }

  const data = (await res.json()) as {
    access_token: string;
    workspace_id: string;
    workspace_name?: string;
  };

  return {
    accessToken: data.access_token,
    workspaceId: data.workspace_id,
    workspaceName: data.workspace_name || 'Notion Workspace',
  };
}
