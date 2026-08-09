import { describe, it, expect, vi } from 'vitest';
import SessionManager from '@/lib/session';
import { stageWrite, getStagedWrites } from './staging';
import { detectWriteCollisions, runWriteConfirmation } from './confirmation';
import type { StagedWrite } from './types';
import type { WriteConfirmationBlock } from '@/lib/types';

describe('staging', () => {
  it('scopes staged writes per session (one response per session)', () => {
    const a = SessionManager.createSession();
    const b = SessionManager.createSession();

    stageWrite(a, {
      kind: 'append',
      target: { id: 'p1', title: 'A' },
      content: 'x',
    });

    expect(getStagedWrites(a)).toHaveLength(1);
    expect(getStagedWrites(b)).toHaveLength(0);
  });
});

describe('detectWriteCollisions', () => {
  it('flags a create whose title matches an existing page (normalized)', () => {
    const writes: StagedWrite[] = [
      {
        kind: 'create',
        parent: { id: 'p1', title: 'P' },
        title: 'Meeting Notes',
        content: 'x',
      },
      {
        kind: 'create',
        parent: { id: null, title: 'Workspace top level' },
        title: 'Fresh Page',
        content: 'y',
      },
    ];
    const known = [{ id: 'p9', title: 'meeting   notes', type: 'page' as const }];

    const collisions = detectWriteCollisions(writes, known);

    expect(collisions.get(0)).toEqual({
      existingId: 'p9',
      existingTitle: 'meeting   notes',
    });
    expect(collisions.has(1)).toBe(false);
  });

  it('never flags append or update writes', () => {
    const writes: StagedWrite[] = [
      {
        kind: 'append',
        target: { id: 'p1', title: 'Meeting Notes' },
        content: 'x',
      },
      {
        kind: 'update',
        target: { id: 'p1', title: 'Meeting Notes' },
        content: 'y',
      },
    ];
    expect(detectWriteCollisions(writes, []).size).toBe(0);
  });
});

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

describe('runWriteConfirmation (reject path)', () => {
  it('marks the card rejected and executes nothing', async () => {
    const session = SessionManager.createSession();
    stageWrite(session, {
      kind: 'append',
      target: { id: 'p1', title: 'A' },
      content: 'x',
    });

    // listAuthorizedPages runs before the decision, but its error is
    // swallowed by the try/catch inside runWriteConfirmation, so a fake
    // db is fine here.
    const outcomePromise = runWriteConfirmation({
      session,
      notionDb: {} as never,
      notionPages: [],
    });
    const block = await waitForConfirmationBlock(session);
    expect(block.data.status).toBe('pending');
    expect(block.data.writes).toHaveLength(1);
    expect(block.data.writes[0].contentPreview).toBe('x');

    session.resolveDecision(block.id, { action: 'reject' });
    const outcome = await outcomePromise;

    expect(outcome.outcome).toBe('rejected');
    expect(outcome.context).toMatch(/rejected/i);

    const updated = session
      .getAllBlocks()
      .find((b) => b.type === 'writeConfirmation') as WriteConfirmationBlock;
    expect(updated.data.status).toBe('rejected');
  });

  it('returns outcome none when nothing was staged', async () => {
    const session = SessionManager.createSession();
    const outcome = await runWriteConfirmation({
      session,
      notionDb: {} as never,
      notionPages: [],
    });
    expect(outcome).toEqual({ outcome: 'none', context: '' });
  });
});
