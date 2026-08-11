import { describe, it, expect, vi, beforeEach } from 'vitest';
import SessionManager from '@/lib/session';
import { stageWrite } from './staging';
import { runWriteConfirmation } from './confirmation';
import {
  appendPageContent,
  createPage,
  updatePageContent,
} from '@/lib/connectors/notion';
import type { WriteConfirmationBlock } from '@/lib/types';

// Mock only the I/O of the connector module; everything else (classes,
// types, search) stays real. This exercises the pause/execute/resume
// flow against a mocked HTTP boundary.
vi.mock('@/lib/connectors/notion', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/connectors/notion')>();
  return {
    ...actual,
    listAuthorizedPages: vi.fn().mockResolvedValue([
      { id: 'p9', title: 'Existing', type: 'page' },
    ]),
    appendPageContent: vi.fn().mockResolvedValue(undefined),
    updatePageContent: vi.fn().mockResolvedValue(undefined),
    createPage: vi
      .fn()
      .mockResolvedValue({ id: 'new1', url: 'https://example.com/new1' }),
    pageUrl: vi.fn((id: string) => `https://example.com/${id}`),
  };
});

const mockedAppend = vi.mocked(appendPageContent);
const mockedUpdate = vi.mocked(updatePageContent);
const mockedCreate = vi.mocked(createPage);

async function waitForConfirmationBlock(
  session: SessionManager,
): Promise<WriteConfirmationBlock> {
  await vi.waitFor(() => {
    const block = session
      .getAllBlocks()
      .find((b) => b.type === 'writeConfirmation');
    expect(block).toBeDefined();
  });
  return session
    .getAllBlocks()
    .find((b) => b.type === 'writeConfirmation') as WriteConfirmationBlock;
}

function confirmBlock(session: SessionManager): WriteConfirmationBlock {
  return session
    .getAllBlocks()
    .find((b) => b.type === 'writeConfirmation') as WriteConfirmationBlock;
}

beforeEach(() => {
  mockedAppend.mockClear();
  mockedUpdate.mockClear();
  mockedCreate.mockClear();
});

describe('runWriteConfirmation (approve path)', () => {
  it('approving executes every staged write and reports results', async () => {
    const session = SessionManager.createSession();
    stageWrite(session, {
      kind: 'append',
      target: { id: 'p1', title: 'Meeting Notes' },
      content: 'hello',
    });
    stageWrite(session, {
      kind: 'create',
      parent: { id: 'p1', title: 'Meeting Notes' },
      title: 'Brand New',
      content: 'body',
    });

    const outcomePromise = runWriteConfirmation({
      session,
      notionDb: {} as never,
      notionPages: [],
    });
    const block = await waitForConfirmationBlock(session);
    session.resolveDecision(block.id, { action: 'approve' });

    const outcome = await outcomePromise;

    expect(outcome.outcome).toBe('approved');
    expect(mockedAppend).toHaveBeenCalledTimes(1);
    expect(mockedAppend).toHaveBeenCalledWith(
      expect.anything(),
      'p1',
      'hello',
    );
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith(expect.anything(), {
      parentId: 'p1',
      title: 'Brand New',
      content: 'body',
    });

    const updated = confirmBlock(session);
    expect(updated.data.status).toBe('approved');
    expect(updated.data.writes[0].result).toEqual({
      ok: true,
      message: 'Appended to "Meeting Notes"',
      url: 'https://example.com/p1',
    });
    expect(updated.data.writes[1].result?.ok).toBe(true);
    expect(outcome.context).toContain('[OK] Append');
    expect(outcome.context).toContain('[OK] Create');
  });

  it('does not treat a same-named database as a write-into-existing target', async () => {
    // listAuthorizedPages is mocked at module level to return only pages;
    // simulate a data source in the conversation selection instead.
    const session = SessionManager.createSession();
    stageWrite(session, {
      kind: 'create',
      parent: { id: null, title: 'Workspace top level' },
      title: 'Existing DB',
      content: 'body',
    });

    const outcomePromise = runWriteConfirmation({
      session,
      notionDb: {} as never,
      notionPages: [
        { id: 'db1', title: 'Existing DB', type: 'database' },
      ],
    });
    const block = await waitForConfirmationBlock(session);

    // No collision: a data source cannot receive a page-content write.
    expect(block.data.writes[0].collision).toBeUndefined();

    session.resolveDecision(block.id, { action: 'approve' });
    await outcomePromise;

    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith(expect.anything(), {
      parentId: null,
      title: 'Existing DB',
      content: 'body',
    });
  });

  it('write-into-existing resolution targets the existing page instead of creating', async () => {
    const session = SessionManager.createSession();
    stageWrite(session, {
      kind: 'create',
      parent: { id: null, title: 'Workspace top level' },
      title: 'Existing',
      content: 'body',
    });

    const outcomePromise = runWriteConfirmation({
      session,
      notionDb: {} as never,
      notionPages: [],
    });
    const block = await waitForConfirmationBlock(session);

    // The collision is detected from the (mocked) authorized set.
    expect(block.data.writes[0].collision).toEqual({
      existingId: 'p9',
      existingTitle: 'Existing',
    });

    session.resolveDecision(block.id, {
      action: 'approve',
      resolutions: { '0': 'write-into-existing' },
    });
    await outcomePromise;

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedUpdate).toHaveBeenCalledTimes(1);
    // "write into existing" appends only — it must not rename the page.
    expect(mockedUpdate).toHaveBeenCalledWith(expect.anything(), 'p9', {
      content: 'body',
    });
  });

  it('cancel resolution skips the collided write', async () => {
    const session = SessionManager.createSession();
    stageWrite(session, {
      kind: 'create',
      parent: { id: null, title: 'Workspace top level' },
      title: 'Existing',
      content: 'body',
    });

    const outcomePromise = runWriteConfirmation({
      session,
      notionDb: {} as never,
      notionPages: [],
    });
    const block = await waitForConfirmationBlock(session);
    session.resolveDecision(block.id, {
      action: 'approve',
      resolutions: { '0': 'cancel' },
    });
    await outcomePromise;

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();
    const updated = confirmBlock(session);
    expect(updated.data.writes[0].result).toEqual({
      ok: false,
      message: 'Cancelled by user',
    });
  });

  it('a missing resolution defaults to the safest option (cancel)', async () => {
    const session = SessionManager.createSession();
    stageWrite(session, {
      kind: 'create',
      parent: { id: null, title: 'Workspace top level' },
      title: 'Existing',
      content: 'body',
    });

    const outcomePromise = runWriteConfirmation({
      session,
      notionDb: {} as never,
      notionPages: [],
    });
    const block = await waitForConfirmationBlock(session);
    session.resolveDecision(block.id, { action: 'approve' });
    await outcomePromise;

    expect(mockedCreate).not.toHaveBeenCalled();
    const updated = confirmBlock(session);
    expect(updated.data.writes[0].result?.message).toBe('Cancelled by user');
  });
});
