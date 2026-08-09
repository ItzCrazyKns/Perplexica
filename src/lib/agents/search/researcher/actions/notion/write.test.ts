import { describe, it, expect } from 'vitest';
import SessionManager from '@/lib/session';
import { getStagedWrites } from '@/lib/agents/search/writes/staging';
import type { AdditionalConfig, SearchActionOutput } from '../../../types';
import {
  notionAppendContentAction,
  notionUpdatePageAction,
  notionCreatePageAction,
} from './write';

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
    )) as SearchActionOutput;

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

  it('refuses a page that was not selected or authorized', async () => {
    const { additionalConfig } = makeConfig([]);

    const output = (await notionAppendContentAction.execute(
      { pageId: 'unknown', content: 'x' },
      additionalConfig,
    )) as SearchActionOutput;

    expect(output.results[0].content).toMatch(/failed|not shared|not authorized/i);
  });
});

describe('notion_update_page', () => {
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
