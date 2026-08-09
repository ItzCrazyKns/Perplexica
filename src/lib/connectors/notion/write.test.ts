import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NotionConnectionDb } from './store';
import { createConnectedDb, createDb } from './test-utils';
import {
  appendPageContent,
  createPage,
  updatePageContent,
  WorkspaceParentUnsupportedError,
} from './write';
import { NotionApiError } from './client';

let db: NotionConnectionDb;

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status < 300,
      status,
      json: async () => body,
    }),
  );
}

beforeEach(() => {
  db = createConnectedDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('appendPageContent', () => {
  it('posts child blocks to the page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await appendPageContent(db, 'p1', 'Hello\n\n- world');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.notion.com/v1/blocks/p1/children');
    // The 2026-03-11 API appends block children with PATCH (POST is
    // rejected with 400 invalid_request_url — verified live).
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body);
    expect(body.children).toHaveLength(2);
    expect(body.children[0].type).toBe('paragraph');
    expect(body.children[1].type).toBe('bulleted_list_item');
  });

  it('makes no request for empty content', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await appendPageContent(db, 'p1', '   ');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws a friendly not-connected error without a connection', async () => {
    const empty = createDb();
    await expect(
      appendPageContent(empty, 'p1', 'x'),
    ).rejects.toMatchObject({ code: 'not_connected' });
  });
});

describe('updatePageContent', () => {
  it('patches the title then appends content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await updatePageContent(db, 'p1', { title: 'T2', content: 'body' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [patchUrl, patchInit] = fetchMock.mock.calls[0];
    expect(patchUrl).toBe('https://api.notion.com/v1/pages/p1');
    expect(patchInit.method).toBe('PATCH');
    expect(JSON.parse(patchInit.body).properties.title[0].text.content).toBe(
      'T2',
    );
    const [appendUrl] = fetchMock.mock.calls[1];
    expect(appendUrl).toBe('https://api.notion.com/v1/blocks/p1/children');
  });

  it('skips the title patch when no title is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await updatePageContent(db, 'p1', { content: 'body' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.notion.com/v1/blocks/p1/children',
    );
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
  });
});

describe('createPage', () => {
  it('creates a workspace-top-level page and returns its url', async () => {
    mockFetch({ id: 'n1', url: 'https://www.notion.so/n1' });

    const page = await createPage(db, {
      parentId: null,
      title: 'New',
      content: 'hi',
    });

    expect(page).toEqual({ id: 'n1', url: 'https://www.notion.so/n1' });
    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe('https://api.notion.com/v1/pages');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.parent).toEqual({ type: 'workspace', workspace: true });
    expect(body.properties.title[0].text.content).toBe('New');
  });

  it('creates a child page under the given parent', async () => {
    mockFetch({ id: 'n2', url: 'https://www.notion.so/n2' });

    await createPage(db, {
      parentId: 'p1',
      title: 'Child',
      content: 'hi',
    });

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.parent).toEqual({ page_id: 'p1' });
  });

  it('maps a rejected workspace parent to WorkspaceParentUnsupportedError', async () => {
    mockFetch(
      {
        code: 'validation_error',
        message: 'Cannot create page with parent type workspace',
      },
      400,
    );

    await expect(
      createPage(db, { parentId: null, title: 'X', content: 'y' }),
    ).rejects.toBeInstanceOf(WorkspaceParentUnsupportedError);
  });

  it('keeps the original error for non-parent failures', async () => {
    mockFetch({ code: 'validation_error', message: 'title is required' }, 400);

    await expect(
      createPage(db, { parentId: null, title: 'X', content: 'y' }),
    ).rejects.toBeInstanceOf(NotionApiError);
  });
});
