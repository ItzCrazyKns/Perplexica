import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NotionConnectionDb } from './store';
import { createConnectedDb, createDb } from './test-utils';
import {
  listAuthorizedPages,
  searchNotionPages,
  fuzzyMatchPages,
} from './search';
import { getPageMarkdown } from './pages';
import { queryDatabase } from './databases';
import { request, NotionApiError, NOTION_API_VERSION } from './client';
import type { AuthorizedPage } from './types';

let db: NotionConnectionDb;

function mockFetchOnce(body: unknown, status = 200) {
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

describe('client', () => {
  it('sends the token, version, and JSON headers on every request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await request('/search', {
      token: 'abc',
      method: 'POST',
      body: { q: 'x' },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.notion.com/v1/search');
    expect(init.headers.Authorization).toBe('Bearer abc');
    expect(init.headers['Notion-Version']).toBe(NOTION_API_VERSION);
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('throws NotionApiError with status and code on error responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 'unauthorized', message: 'Invalid token' }),
      }),
    );

    await expect(
      request('/search', { token: 'bad', method: 'POST', body: {} }),
    ).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
  });
});

describe('authorized pages', () => {
  it('lists pages and data sources, extracting titles from both shapes', async () => {
    mockFetchOnce({
      results: [
        {
          id: 'p1',
          object: 'page',
          properties: {
            Name: { type: 'title', title: [{ plain_text: 'Meeting Notes' }] },
          },
        },
        {
          id: 'd1',
          object: 'database',
          title: [{ plain_text: 'Projects DB' }],
        },
        {
          id: 'ds1',
          object: 'data_source',
          name: 'Meeting Tasks',
        },
        {
          id: 'p2',
          object: 'page',
          properties: { Other: { type: 'rich_text', rich_text: [] } },
        },
      ],
      has_more: false,
      next_cursor: null,
    });

    const pages = await listAuthorizedPages(db);
    expect(pages).toEqual([
      { id: 'p1', title: 'Meeting Notes', type: 'page' },
      { id: 'd1', title: 'Projects DB', type: 'database' },
      { id: 'ds1', title: 'Meeting Tasks', type: 'database' },
      { id: 'p2', title: 'Untitled', type: 'page' },
    ]);
  });

  it('follows has_more and next_cursor to collect every authorized page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 'p1',
              object: 'page',
              properties: {
                Name: { type: 'title', title: [{ plain_text: 'First' }] },
              },
            },
          ],
          has_more: true,
          next_cursor: 'cur1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ id: 'ds1', object: 'data_source', name: 'Second' }],
          has_more: false,
          next_cursor: null,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const pages = await listAuthorizedPages(db);
    expect(pages.map((p) => p.id)).toEqual(['p1', 'ds1']);
    // The second request carries the cursor in its body.
    const [, init2] = fetchMock.mock.calls[1];
    expect(JSON.parse(init2.body).start_cursor).toBe('cur1');
  });

  it('throws a clear error when no connection exists', async () => {
    await expect(listAuthorizedPages(createDb())).rejects.toThrow(
      /not connected/i,
    );
  });
});

describe('fuzzy page search', () => {
  const pages: AuthorizedPage[] = [
    { id: '1', title: 'Meeting Notes', type: 'page' },
    { id: '2', title: 'Product Roadmap', type: 'page' },
    { id: '3', title: 'Meeting Agenda Q3', type: 'page' },
  ];

  it('matches the leading words of a title, tolerating partial words', () => {
    // "meet" is a prefix of the leading word of both meeting pages.
    const ids = fuzzyMatchPages(pages, 'meet').map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['1', '3']));
  });

  it('ranks an exact title match first', () => {
    const ids = fuzzyMatchPages(pages, 'Product Roadmap').map((p) => p.id);
    expect(ids[0]).toBe('2');
  });

  it('matches when the query word is a prefix of a title word', () => {
    expect(fuzzyMatchPages(pages, 'road').map((p) => p.id)).toEqual(['2']);
  });

  it('returns no candidates for a non-matching name', () => {
    expect(fuzzyMatchPages(pages, 'xyzzy')).toEqual([]);
    expect(fuzzyMatchPages(pages, '   ')).toEqual([]);
  });

  it('ranks leading-word matches above loose word matches', () => {
    const mixed: AuthorizedPage[] = [
      { id: 'a', title: 'Quarterly Planning', type: 'page' },
      { id: 'b', title: 'Notes from the quarterly review', type: 'page' },
    ];
    const ids = fuzzyMatchPages(mixed, 'quarter').map((p) => p.id);
    // "quarterly" starts with "quarter" → leading match (a) beats containment (b).
    expect(ids).toEqual(['a', 'b']);
  });
});

describe('page content', () => {
  it('returns page content as markdown from the page markdown endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        markdown: '# Title\n\nSome text',
        truncated: false,
        unknown_block_ids: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPageMarkdown(db, 'p1')).resolves.toBe(
      '# Title\n\nSome text',
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.notion.com/v1/pages/p1/markdown',
    );
  });

  it('recursively fetches unknown block subtrees when the page is truncated', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          markdown: '# Big page\nfirst part',
          truncated: true,
          unknown_block_ids: ['u1', 'u2'],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          markdown: 'rest of the page',
          truncated: false,
          unknown_block_ids: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ code: 'object_not_found', message: 'nope' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const text = await getPageMarkdown(db, 'p1');
    expect(text).toContain('first part');
    expect(text).toContain('rest of the page');
    // A subtree without markdown support (404) is skipped, not fatal.
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.notion.com/v1/pages/u1/markdown',
    );
  });

  it('falls back to block children, paginating and flattening tables', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ code: 'object_not_found', message: 'nope' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 'b1',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ plain_text: 'Hello ' }, { plain_text: 'world' }],
              },
            },
          ],
          has_more: true,
          next_cursor: 'cur1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 'bt',
              type: 'table_row',
              table_row: {
                cells: [[{ plain_text: 'Cell A' }], [{ plain_text: 'Cell B' }]],
              },
            },
            {
              id: 'b2',
              type: 'child_page',
              child_page: { title: 'Sub' },
              has_children: true,
            },
          ],
          has_more: false,
          next_cursor: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 'b3',
              type: 'heading_2',
              heading_2: { rich_text: [{ plain_text: 'Nested' }] },
            },
          ],
          has_more: false,
          next_cursor: null,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const text = await getPageMarkdown(db, 'p1');
    expect(text).toContain('Hello world');
    expect(text).toContain('Cell A | Cell B');
    expect(text).toContain('[Sub]');
    expect(text).toContain('Nested');
  });
});

describe('database query', () => {
  it('queries a data source and flattens entries into readable text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            id: 'row1',
            properties: {
              Name: {
                type: 'title',
                title: [{ plain_text: 'Build Notion connector' }],
              },
              Status: { type: 'select', select: { name: 'In progress' } },
              Tags: {
                type: 'multi_select',
                multi_select: [{ name: 'backend' }, { name: 'vane' }],
              },
              Score: {
                type: 'formula',
                formula: { type: 'number', number: 42 },
              },
              Due: { type: 'date', date: { start: '2026-08-15' } },
              Done: { type: 'checkbox', checkbox: false },
            },
          },
        ],
        has_more: false,
        next_cursor: null,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const entries = await queryDatabase(db, 'ds1');
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('Build Notion connector');
    expect(entries[0].text).toContain('Status: In progress');
    expect(entries[0].text).toContain('Tags: backend, vane');
    expect(entries[0].text).toContain('Score: 42');
    expect(entries[0].text).toContain('Due: 2026-08-15');
    expect(entries[0].text).toContain('Done: No');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.notion.com/v1/data_sources/ds1/query',
    );
  });

  it('resolves legacy database ids to their first data source', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ code: 'object_not_found', message: 'nope' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data_sources: [{ id: 'ds1' }, { id: 'ds2' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 'row1',
              properties: {
                Name: {
                  type: 'title',
                  title: [{ plain_text: 'Legacy row' }],
                },
              },
            },
          ],
          has_more: false,
          next_cursor: null,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const entries = await queryDatabase(db, 'db1');
    expect(entries[0].title).toBe('Legacy row');
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.notion.com/v1/databases/db1',
    );
    expect(fetchMock.mock.calls[2][0]).toBe(
      'https://api.notion.com/v1/data_sources/ds1/query',
    );
  });

  it('follows has_more when querying a data source', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 'row1',
              properties: {
                Name: { type: 'title', title: [{ plain_text: 'First' }] },
              },
            },
          ],
          has_more: true,
          next_cursor: 'cur2',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 'row2',
              properties: {
                Name: { type: 'title', title: [{ plain_text: 'Second' }] },
              },
            },
          ],
          has_more: false,
          next_cursor: null,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const entries = await queryDatabase(db, 'ds1');
    expect(entries.map((e) => e.title)).toEqual(['First', 'Second']);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).start_cursor).toBe(
      'cur2',
    );
  });
});

describe('searchNotionPages', () => {
  it('searches pages by query text, mapping data sources to databases', async () => {
    mockFetchOnce({
      results: [
        {
          id: 'p1',
          object: 'page',
          properties: {
            Name: { type: 'title', title: [{ plain_text: 'Meeting Notes' }] },
          },
        },
        {
          id: 'ds1',
          object: 'data_source',
          name: 'Meeting Tasks',
        },
      ],
      has_more: false,
      next_cursor: null,
    });

    const pages = await searchNotionPages(db, 'meeting');
    expect(pages).toEqual([
      { id: 'p1', title: 'Meeting Notes', type: 'page' },
      { id: 'ds1', title: 'Meeting Tasks', type: 'database' },
    ]);
  });
});
