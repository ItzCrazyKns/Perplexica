/**
 * Minimal HTTP client for the Notion API. Every request goes through
 * this client so the token and Notion-Version header are applied once
 * (see ADR-0004). Uses global fetch, consistent with the rest of Vane.
 */

export const NOTION_API_BASE = 'https://api.notion.com/v1';
export const NOTION_API_VERSION = '2026-03-11';

export class NotionApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'NotionApiError';
  }
}

export interface RequestOptions {
  token: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string>;
}

export async function request<T>(
  path: string,
  options: RequestOptions,
): Promise<T> {
  const { token, method = 'GET', body, query } = options;

  const url = new URL(`${NOTION_API_BASE}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_API_VERSION,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let code: string | undefined;
    let message = `Notion API request failed (${res.status})`;
    try {
      const payload = (await res.json()) as { code?: string; message?: string };
      code = payload.code;
      if (payload.message) message = payload.message;
    } catch {
      // Non-JSON error body; keep the default message.
    }
    throw new NotionApiError(message, res.status, code);
  }

  return (await res.json()) as T;
}
