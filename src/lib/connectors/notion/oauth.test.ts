import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  getClientCredentials,
  getPublicOrigin,
  getRedirectUri,
  NotionOAuthError,
} from './oauth';
import { NOTION_API_VERSION } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NOTION_CLIENT_ID;
  delete process.env.NOTION_CLIENT_SECRET;
  delete process.env.NOTION_REDIRECT_URI;
});

describe('buildAuthorizeUrl', () => {
  it('builds the Notion authorize URL with all required params', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: 'client_123',
        redirectUri: 'http://localhost:3000/api/notion/callback',
        state: 'state_abc',
      }),
    );

    expect(url.origin + url.pathname).toBe(
      'https://api.notion.com/v1/oauth/authorize',
    );
    expect(url.searchParams.get('client_id')).toBe('client_123');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/notion/callback',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('owner')).toBe('user');
    expect(url.searchParams.get('state')).toBe('state_abc');
  });
});

describe('getClientCredentials', () => {
  it('returns null when the env vars are missing', () => {
    delete process.env.NOTION_CLIENT_ID;
    delete process.env.NOTION_CLIENT_SECRET;
    expect(getClientCredentials()).toBeNull();
  });

  it('reads credentials from env vars', () => {
    process.env.NOTION_CLIENT_ID = 'cid';
    process.env.NOTION_CLIENT_SECRET = 'csec';
    expect(getClientCredentials()).toEqual({
      clientId: 'cid',
      clientSecret: 'csec',
    });
    delete process.env.NOTION_CLIENT_ID;
    delete process.env.NOTION_CLIENT_SECRET;
  });
});

describe('getPublicOrigin / getRedirectUri', () => {
  it('derives from req.url when no override is set (local dev)', () => {
    const req = new Request('http://localhost:3000/api/notion/auth');
    expect(getPublicOrigin(req)).toBe('http://localhost:3000');
    expect(getRedirectUri(req)).toBe(
      'http://localhost:3000/api/notion/callback',
    );
  });

  it('uses NOTION_REDIRECT_URI when set (Docker port-mapping)', () => {
    // In Docker, req.url carries the container's internal address.
    const req = new Request('http://751169bff0dc:3000/api/notion/auth');
    process.env.NOTION_REDIRECT_URI =
      'http://localhost:3100/api/notion/callback';
    expect(getPublicOrigin(req)).toBe('http://localhost:3100');
    expect(getRedirectUri(req)).toBe(
      'http://localhost:3100/api/notion/callback',
    );
  });
});

describe('exchangeCodeForToken', () => {
  it('exchanges a code with Basic auth and parses the token response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'ntkn_abc',
        workspace_id: 'ws_1',
        workspace_name: 'My Workspace',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await exchangeCodeForToken({
      clientId: 'cid',
      clientSecret: 'csec',
      code: 'code_xyz',
      redirectUri: 'http://localhost:3000/api/notion/callback',
    });

    expect(result).toEqual({
      accessToken: 'ntkn_abc',
      workspaceId: 'ws_1',
      workspaceName: 'My Workspace',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.notion.com/v1/oauth/token');
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from('cid:csec').toString('base64')}`,
    );
    expect(init.headers['Notion-Version']).toBe(NOTION_API_VERSION);
    expect(JSON.parse(init.body)).toEqual({
      grant_type: 'authorization_code',
      code: 'code_xyz',
      redirect_uri: 'http://localhost:3000/api/notion/callback',
    });
  });

  it('throws NotionOAuthError on a failed exchange', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'bad code',
        }),
      }),
    );

    await expect(
      exchangeCodeForToken({
        clientId: 'cid',
        clientSecret: 'csec',
        code: 'bad',
        redirectUri: 'http://localhost:3000/api/notion/callback',
      }),
    ).rejects.toThrow(/invalid_grant/);
  });
});
