import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NotionConnectionDb } from './store';
import { createConnectedDb, createDb } from './test-utils';
import {
  listAuthorizedPages,
  searchNotionPages,
  fuzzyMatchPages,
  filterAuthorizedPages,
  resolveAuthorizedPage,
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
  it('lists pages and data sources with two filtered searches', async () => {
    const fetchMock = vi
      .fn()
      // First request: pages only.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 'p1',
              object: 'page',
              properties: {
                Name: {
                  type: 'title',
                  title: [{ plain_text: 'Meeting Notes' }],
                },
              },
            },
            {
              id: 'p2',
              object: 'page',
              properties: { Other: { type: 'rich_text', rich_text: [] } },
            },
          ],
          has_more: false,
          next_cursor: null,
        }),
      })
      // Second request: data sources only (legacy `database` shape too).
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
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
          ],
          has_more: false,
          next_cursor: null,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const pages = await listAuthorizedPages(db);
    expect(pages).toEqual([
      { id: 'p1', title: 'Meeting Notes', type: 'page' },
      { id: 'p2', title: 'Untitled', type: 'page' },
      { id: 'd1', title: 'Projects DB', type: 'database' },
      { id: 'ds1', title: 'Meeting Tasks', type: 'database' },
    ]);

    // Each request uses the current filter and carries in_trash.
    const body1 = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body1.filter).toEqual({
      property: 'object',
      value: 'page',
      in_trash: false,
    });
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body2.filter).toEqual({
      property: 'object',
      value: 'data_source',
      in_trash: false,
    });
  });

  it('follows has_more and next_cursor within each filtered search', async () => {
    const fetchMock = vi
      .fn()
      // Pages: first page + cursor continuation.
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
          results: [
            {
              id: 'p2',
              object: 'page',
              properties: {
                Name: { type: 'title', title: [{ plain_text: 'Second page' }] },
              },
            },
          ],
          has_more: false,
          next_cursor: null,
        }),
      })
      // Data sources.
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
    expect(pages.map((p) => p.id)).toEqual(['p1', 'p2', 'ds1']);
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

  it('stays unresolved when an overlapping word conflicts', () => {
    // "Meeting Budget" must not resolve to "Meeting Notes": the second
    // overlapping word conflicts, so the user is asked to confirm.
    const pages: AuthorizedPage[] = [
      { id: '1', title: 'Meeting Notes', type: 'page' },
      { id: '2', title: 'Meeting Agenda Q3', type: 'page' },
    ];
    expect(fuzzyMatchPages(pages, 'Meeting Budget')).toEqual([]);
    expect(fuzzyMatchPages(pages, 'meet budg')).toEqual([]);
  });

  it('allows extra trailing query words after a full leading match', () => {
    const pages: AuthorizedPage[] = [
      { id: '1', title: 'Meeting Notes', type: 'page' },
    ];
    const ids = fuzzyMatchPages(pages, 'Meeting Notes 2026').map((p) => p.id);
    expect(ids).toEqual(['1']);
  });

  it('never lets a partial leading match outrank an exact title', () => {
    const pages: AuthorizedPage[] = [
      { id: '1', title: 'Meeting Notes', type: 'page' },
      { id: '2', title: 'Meeting Notes Draft', type: 'page' },
    ];
    // Both words of the query are leading prefixes of "Meeting Notes Draft",
    // but the exact title must still rank first.
    const ids = fuzzyMatchPages(pages, 'Meeting Notes').map((p) => p.id);
    expect(ids[0]).toBe('1');
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

describe('authorized page resolution', () => {
  const authorized: AuthorizedPage[] = [
    { id: 'p1', title: 'Meeting Notes', type: 'page' },
    { id: 'ds1', title: 'Tasks DB', type: 'database' },
  ];

  function mockAuthorizedSearch() {
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
                Name: {
                  type: 'title',
                  title: [{ plain_text: 'Meeting Notes' }],
                },
              },
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
          results: [{ id: 'ds1', object: 'data_source', name: 'Tasks DB' }],
          has_more: false,
          next_cursor: null,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
  }

  it('filterAuthorizedPages keeps only shared pages, with server titles', async () => {
    mockAuthorizedSearch();

    const result = await filterAuthorizedPages(db, [
      { id: 'p1', title: 'Spoofed Title', type: 'page' },
      { id: 'ghost', title: 'Not shared', type: 'page' },
    ]);

    // Server-side title wins; unshared ids are dropped.
    expect(result).toEqual([
      { id: 'p1', title: 'Meeting Notes', type: 'page' },
    ]);
  });

  it('resolveAuthorizedPage prefers conversation-attached pages without an API call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const page = await resolveAuthorizedPage(db, 'p1', authorized);
    expect(page).toEqual({ id: 'p1', title: 'Meeting Notes', type: 'page' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolveAuthorizedPage falls back to the authorized set', async () => {
    mockAuthorizedSearch();

    const page = await resolveAuthorizedPage(db, 'ds1', []);
    expect(page).toEqual({ id: 'ds1', title: 'Tasks DB', type: 'database' });
  });

  it('resolveAuthorizedPage returns null for unshared ids', async () => {
    mockAuthorizedSearch();

    await expect(resolveAuthorizedPage(db, 'ghost', [])).resolves.toBeNull();
  });
});

describe('searchNotionPages', () => {
  it('searches pages by query text, mapping data sources to databases', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
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
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const pages = await searchNotionPages(db, 'meeting');
    expect(pages).toEqual([
      { id: 'p1', title: 'Meeting Notes', type: 'page' },
      { id: 'ds1', title: 'Meeting Tasks', type: 'database' },
    ]);
    // A strong title match was found on the first pass — no retry.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries with a whitespace-stripped query when CJK spaces hide the exact title', async () => {
    const fetchMock = vi
      .fn()
      // Raw (spaced) query: Notion ranks an incidental content match first.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 'wrong',
              object: 'page',
              properties: {
                Name: {
                  type: 'title',
                  title: [
                    { plain_text: '2026-06-29筆記 UX設計思維與產品開發流程' },
                  ],
                },
              },
            },
          ],
          has_more: false,
          next_cursor: null,
        }),
      })
      // Stripped query: the exact-title page surfaces.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 'exact',
              object: 'page',
              properties: {
                Name: {
                  type: 'title',
                  title: [{ plain_text: '塔羅牌App開發BDD架構' }],
                },
              },
            },
          ],
          has_more: false,
          next_cursor: null,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const pages = await searchNotionPages(db, '塔羅牌 App 開發 BDD 架構');
    // The exact-title page must come first despite Notion ranking the
    // content match above it on the raw query; the incidental content
    // match is preserved below it (never dropped, never promoted).
    expect(pages.map((p) => p.id)).toEqual(['exact', 'wrong']);
    expect(pages[0].title).toBe('塔羅牌App開發BDD架構');
    // Second request re-searched with the whitespace-stripped variant.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).query).toBe(
      '塔羅牌App開發BDD架構',
    );
  });

  it('does not let the listing fallback swallow legitimate weak matches', async () => {
    // A query like "UX" only matches titles by word-containment (score 30
    // — below the strong threshold). The API returns those pages; the
    // fallback listing finds nothing stronger, so the weak matches must
    // still be returned, not replaced by an empty result.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 'ux1',
              object: 'page',
              properties: {
                Name: {
                  type: 'title',
                  title: [
                    { plain_text: '2026-06-29筆記 UX設計思維與產品開發流程' },
                  ],
                },
              },
            },
          ],
          has_more: false,
          next_cursor: null,
        }),
      })
      // Fallback listing: pages filter (empty), data sources filter (empty).
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [], has_more: false, next_cursor: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [], has_more: false, next_cursor: null }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const pages = await searchNotionPages(db, 'UX');
    expect(pages.map((p) => p.id)).toEqual(['ux1']);
  });

  it('falls back to the authorized set when the API search misses the page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [], has_more: false, next_cursor: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [], has_more: false, next_cursor: null }),
      })
      // Listing: the pages-filtered search returns the page the API
      // full-text search missed.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: 'p1',
              object: 'page',
              properties: {
                Name: { type: 'title', title: [{ plain_text: 'Meeting Notes' }] },
              },
            },
          ],
          has_more: false,
          next_cursor: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [], has_more: false, next_cursor: null }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const pages = await searchNotionPages(db, 'Meeting Note');
    expect(pages).toEqual([
      { id: 'p1', title: 'Meeting Notes', type: 'page' },
    ]);
  });
});
