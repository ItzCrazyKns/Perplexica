import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NotionConnectionDb } from '@/lib/connectors/notion/store';
import {
  createConnectedDb,
  createDb,
  TEST_ACCESS_TOKEN,
} from '@/lib/connectors/notion/test-utils';
import SessionManager from '@/lib/session';
import type { AdditionalConfig, SearchActionOutput } from '../../../types';
import notionSearchAction from './search';
import { notionGetPageAction, notionQueryDatabaseAction } from './read';

let db: NotionConnectionDb;
let session: SessionManager;
let researchBlockId: string;

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

type ExecuteConfig = AdditionalConfig & {
  researchBlockId: string;
  fileIds: string[];
  mode: 'speed' | 'balanced' | 'quality';
};

function makeConfig(
  overrides: {
    notionPages?: any[];
    db?: NotionConnectionDb;
  } = {},
): ExecuteConfig {
  return {
    llm: {} as any,
    embedding: {} as any,
    session,
    researchBlockId,
    fileIds: [],
    mode: 'balanced',
    notionDb: overrides.db ?? db,
    notionPages: overrides.notionPages ?? [],
  };
}

function emitResearchBlock() {
  session.emitBlock({
    id: researchBlockId,
    type: 'research',
    data: { subSteps: [] },
  });
}

beforeEach(() => {
  db = createConnectedDb();
  session = SessionManager.createSession();
  researchBlockId = crypto.randomUUID();
  emitResearchBlock();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const enabledConfig = {
  classification: {
    classification: {
      skipSearch: false,
      personalSearch: true,
      academicSearch: false,
      discussionSearch: false,
      showWeatherWidget: false,
      showStockWidget: false,
      showCalculationWidget: false,
    },
    standaloneFollowUp: 'x',
  },
  fileIds: [],
  mode: 'balanced' as const,
};

describe('notion tool gating', () => {
  it('enables the tools only when the notion source is active', () => {
    for (const action of [
      notionSearchAction,
      notionGetPageAction,
      notionQueryDatabaseAction,
    ]) {
      expect(action.enabled({ ...enabledConfig, sources: ['notion'] })).toBe(
        true,
      );
      expect(action.enabled({ ...enabledConfig, sources: ['web'] })).toBe(
        false,
      );
      expect(action.enabled({ ...enabledConfig, sources: [] })).toBe(false);
    }
  });
});

describe('notion_search', () => {
  const attachedPages = [
    { id: 'p1', title: 'Meeting Notes', type: 'page' as const },
    { id: 'd1', title: 'Projects DB', type: 'database' as const },
  ];

  it('resolves an attached page by leading-word fuzzy match without hitting the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const output = (await notionSearchAction.execute(
      { query: 'meet' },
      makeConfig({ notionPages: attachedPages }),
    )) as SearchActionOutput;

    expect(fetchMock).not.toHaveBeenCalled();
    expect(output.results).toHaveLength(1);
    expect(output.results[0].metadata.title).toBe('Meeting Notes');
    expect(output.results[0].metadata.notionId).toBe('p1');
    expect(output.results[0].content).toContain('p1');
  });

  it('falls back to the Notion API search when no attached page matches', async () => {
    mockFetchOnce({
      results: [
        {
          id: 'x9',
          object: 'page',
          properties: {
            Name: {
              type: 'title',
              title: [{ plain_text: 'Roadmap 2026' }],
            },
          },
        },
      ],
      has_more: false,
      next_cursor: null,
    });

    const output = (await notionSearchAction.execute(
      { query: 'roadmap' },
      makeConfig({ notionPages: attachedPages }),
    )) as SearchActionOutput;

    expect(output.results[0].metadata.title).toBe('Roadmap 2026');
    expect(output.results[0].content).toContain('notion_get_page');
  });

  it('returns candidate pages and asks the user when nothing matches', async () => {
    mockFetchOnce({ results: [], has_more: false, next_cursor: null });

    const output = (await notionSearchAction.execute(
      { query: 'xyzzy' },
      makeConfig({ notionPages: attachedPages }),
    )) as SearchActionOutput;

    expect(output.results[0].content).toContain('No Notion page matched');
    expect(output.results[0].content).toContain('Meeting Notes');
    expect(output.results[0].content).toContain('never guess');
  });

  it('returns a friendly not-connected result instead of throwing', async () => {
    const output = (await notionSearchAction.execute(
      { query: 'notes' },
      makeConfig({ db: createDb(), notionPages: [] }),
    )) as SearchActionOutput;

    expect(output.results[0].content).toMatch(/not connected/i);
  });

  it('emits notion substeps onto the research block', async () => {
    await notionSearchAction.execute(
      { query: 'meet' },
      makeConfig({ notionPages: attachedPages }),
    );

    const block = session.getBlock(researchBlockId) as any;
    const types = block.data.subSteps.map((s: any) => s.type);
    expect(types).toEqual(['notion_searching', 'notion_search_results']);
  });
});

describe('notion_get_page', () => {
  it('returns the page markdown as a finding', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        markdown: '# Agenda\n\nDiscuss Q3 plans',
        truncated: false,
        unknown_block_ids: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const output = (await notionGetPageAction.execute(
      { pageId: 'p1' },
      makeConfig({
        notionPages: [{ id: 'p1', title: 'Meeting Notes', type: 'page' }],
      }),
    )) as SearchActionOutput;

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.notion.com/v1/pages/p1/markdown',
    );
    expect(output.results[0].content).toContain('Discuss Q3 plans');
    expect(output.results[0].metadata.title).toBe('Meeting Notes');
  });

  it('surfaces inaccessible pages as a friendly message', async () => {
    mockFetchOnce({ code: 'object_not_found', message: 'nope' }, 404);

    const output = (await notionGetPageAction.execute(
      { pageId: 'p1' },
      makeConfig(),
    )) as SearchActionOutput;

    expect(output.results[0].content).toContain('404');
  });

  it('returns a friendly not-connected result instead of throwing', async () => {
    const output = (await notionGetPageAction.execute(
      { pageId: 'p1' },
      makeConfig({ db: createDb() }),
    )) as SearchActionOutput;

    expect(output.results[0].content).toMatch(/not connected/i);
  });

  it('returns a friendly result on network errors instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );

    const output = (await notionGetPageAction.execute(
      { pageId: 'p1' },
      makeConfig(),
    )) as SearchActionOutput;

    expect(output.results[0].content).toMatch(/failed/i);
  });
});

describe('notion_query_database', () => {
  it('flattens database rows into findings', async () => {
    mockFetchOnce({
      results: [
        {
          id: 'row1',
          properties: {
            Name: {
              type: 'title',
              title: [{ plain_text: 'Build Notion connector' }],
            },
            Status: { type: 'select', select: { name: 'In progress' } },
          },
        },
        {
          id: 'row2',
          properties: {
            Name: { type: 'title', title: [{ plain_text: 'Ship PR1' }] },
            Status: { type: 'select', select: { name: 'Done' } },
          },
        },
      ],
    });

    const output = (await notionQueryDatabaseAction.execute(
      { databaseId: 'd1' },
      makeConfig({
        notionPages: [{ id: 'd1', title: 'Projects DB', type: 'database' }],
      }),
    )) as SearchActionOutput;

    expect(output.results).toHaveLength(2);
    expect(output.results[0].metadata.title).toBe('Build Notion connector');
    expect(output.results[0].content).toContain('Status: In progress');
    expect(output.results[1].content).toContain('Status: Done');
  });

  it('refuses to query a database that was not selected or authorized', async () => {
    // The authorized set contains only a page; 'd1' is not shared.
    mockFetchOnce({
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
    });

    const output = (await notionQueryDatabaseAction.execute(
      { databaseId: 'd1' },
      makeConfig(),
    )) as SearchActionOutput;

    expect(output.results[0].content).toMatch(/not shared|not authorized/i);
  });

  it('returns a friendly not-connected result instead of throwing', async () => {
    const output = (await notionQueryDatabaseAction.execute(
      { databaseId: 'd1' },
      makeConfig({ db: createDb() }),
    )) as SearchActionOutput;

    expect(output.results[0].content).toMatch(/not connected/i);
  });
});

describe('token plumbing', () => {
  it('actions use the injected connection token for API calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        markdown: 'hi',
        has_more: false,
        next_cursor: null,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await notionGetPageAction.execute({ pageId: 'p1' }, makeConfig());

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      `Bearer ${TEST_ACCESS_TOKEN}`,
    );
  });
});
