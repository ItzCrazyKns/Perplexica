import { describe, it, expect, vi } from 'vitest';
import SessionManager from '@/lib/session';
import { getStagedWrites } from '@/lib/agents/search/writes/staging';
import * as notion from '@/lib/connectors/notion';
import type {
  AdditionalConfig,
  SearchActionOutput,
  StagedWriteOutput,
} from '../../../types';
import {
  notionAppendContentAction,
  notionUpdatePageAction,
  notionCreatePageAction,
} from './write';

// The barrel re-exports resolveAuthorizedPage/listAuthorizedPages from a
// submodule. Rebuild resolveAuthorizedPage on top of a mocked empty
// authorized list, preserving the real attached-pages shortcut, so the
// "not authorized" path resolves to null instead of hitting the fake db.
vi.mock('@/lib/connectors/notion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/connectors/notion')>();
  const listAuthorizedPages = vi.fn().mockResolvedValue([]);
  return {
    ...actual,
    listAuthorizedPages,
    resolveAuthorizedPage: vi.fn(
      async (
        _db: unknown,
        pageId: string,
        attached: { id: string }[] = [],
      ) => {
        const inAttached = attached.find((page) => page.id === pageId);
        if (inAttached) return inAttached;
        const authorized = (await listAuthorizedPages()) as { id: string }[];
        return authorized.find((page) => page.id === pageId) ?? null;
      },
    ),
  };
});

const attachedPages = [
  { id: 'p1', title: 'Meeting Notes', type: 'page' as const },
];

function makeConfig(notionPages: any[] = attachedPages) {
  const session = SessionManager.createSession();
  const additionalConfig: AdditionalConfig & {
    researchBlockId: string;
    fileIds: string[];
    mode: 'speed' | 'balanced' | 'quality';
  } = {
    llm: {} as any,
    embedding: {} as any,
    session,
    researchBlockId: crypto.randomUUID(),
    fileIds: [],
    mode: 'balanced',
    // Never touched while the target is attached to the conversation.
    notionDb: {} as any,
    notionPages,
  };
  return { session, additionalConfig };
}

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

describe('notion write tool gating', () => {
  it('enables the tools only when the notion source is active', () => {
    for (const action of [
      notionAppendContentAction,
      notionUpdatePageAction,
      notionCreatePageAction,
    ]) {
      expect(action.enabled({ ...enabledConfig, sources: ['notion'] })).toBe(
        true,
      );
      expect(action.enabled({ ...enabledConfig, sources: ['web'] })).toBe(
        false,
      );
    }
  });
});

describe('notion_append_content', () => {
  it('stages an append against an attached page without executing', async () => {
    const { session, additionalConfig } = makeConfig();

    const output = (await notionAppendContentAction.execute(
      { pageId: 'p1', content: 'hello world' },
      additionalConfig,
    )) as StagedWriteOutput;

    // Staged writes must not surface as user-facing search results; the
    // confirmation card is their only presentation.
    expect(output.type).toBe('staged_write');
    expect(output.results[0].content).toContain('Staged');
    expect(output.results[0].content).toContain('Meeting Notes');

    expect(getStagedWrites(session)).toEqual([
      {
        kind: 'append',
        target: { id: 'p1', title: 'Meeting Notes' },
        content: 'hello world',
      },
    ]);
  });

  it('rejects blank or whitespace-only content without staging', async () => {
    const { session, additionalConfig } = makeConfig();

    const output = (await notionAppendContentAction.execute(
      { pageId: 'p1', content: '   ' },
      additionalConfig,
    )) as SearchActionOutput;

    expect(getStagedWrites(session)).toHaveLength(0);
    expect(output.type).toBe('search_results');
    expect(output.results[0].content).toMatch(/blank/i);
  });

  it('refuses a page that was not selected or authorized', async () => {
    const { additionalConfig } = makeConfig([]);
    // With nothing attached, resolveAuthorizedPage falls back to the
    // authorized list (mocked empty) so the "not authorized" path is
    // exercised — not the not-connected path.

    const output = (await notionAppendContentAction.execute(
      { pageId: 'unknown', content: 'x' },
      additionalConfig,
    )) as SearchActionOutput;

    expect(notion.listAuthorizedPages).toHaveBeenCalled();
    expect(getStagedWrites(additionalConfig.session)).toHaveLength(0);
    expect(output.results[0].content).toMatch(/not shared|not authorized/i);
  });

  it('is not offered when writes are disabled (no confirmation flow)', () => {
    expect(
      notionAppendContentAction.enabled({
        ...enabledConfig,
        sources: ['notion'],
        allowWrites: false,
      }),
    ).toBe(false);
    expect(
      notionCreatePageAction.enabled({
        ...enabledConfig,
        sources: ['notion'],
        allowWrites: false,
      }),
    ).toBe(false);
  });
});

describe('notion_update_page', () => {
  it('rejects an update with neither content nor a title', async () => {
    const { session, additionalConfig } = makeConfig();

    const output = (await notionUpdatePageAction.execute(
      { pageId: 'p1', content: '  ' },
      additionalConfig,
    )) as SearchActionOutput;

    expect(getStagedWrites(session)).toHaveLength(0);
    expect(output.type).toBe('search_results');
    expect(output.results[0].content).toMatch(/blank/i);
  });

  it('stages an update with an optional new title', async () => {
    const { session, additionalConfig } = makeConfig();

    await notionUpdatePageAction.execute(
      { pageId: 'p1', title: 'Renamed', content: 'new body' },
      additionalConfig,
    );

    expect(getStagedWrites(session)).toEqual([
      {
        kind: 'update',
        target: { id: 'p1', title: 'Meeting Notes' },
        title: 'Renamed',
        content: 'new body',
      },
    ]);
  });
});

describe('notion_create_page', () => {
  it('stages a top-level create when no parent is given', async () => {
    const { session, additionalConfig } = makeConfig();

    await notionCreatePageAction.execute(
      { title: 'Fresh', content: 'body' },
      additionalConfig,
    );

    expect(getStagedWrites(session)).toEqual([
      {
        kind: 'create',
        parent: { id: null, title: 'Workspace top level' },
        title: 'Fresh',
        content: 'body',
      },
    ]);
  });

  it('rejects a blank title without staging', async () => {
    const { session, additionalConfig } = makeConfig();

    const output = (await notionCreatePageAction.execute(
      { title: '  ', content: 'body' },
      additionalConfig,
    )) as SearchActionOutput;

    expect(getStagedWrites(session)).toHaveLength(0);
    expect(output.results[0].content).toMatch(/blank/i);
  });

  it('rejects an empty parentId instead of creating at the top level', async () => {
    const { session, additionalConfig } = makeConfig([]);

    const output = (await notionCreatePageAction.execute(
      { title: 'Fresh', content: 'body', parentId: '' },
      additionalConfig,
    )) as SearchActionOutput;

    expect(getStagedWrites(session)).toHaveLength(0);
    expect(output.results[0].content).toMatch(/not shared|not authorized/i);
  });

  it('stages a create under an attached parent page', async () => {
    const { session, additionalConfig } = makeConfig();

    await notionCreatePageAction.execute(
      { title: 'Child', content: 'body', parentId: 'p1' },
      additionalConfig,
    );

    expect(getStagedWrites(session)).toEqual([
      {
        kind: 'create',
        parent: { id: 'p1', title: 'Meeting Notes' },
        title: 'Child',
        content: 'body',
      },
    ]);
  });
});
