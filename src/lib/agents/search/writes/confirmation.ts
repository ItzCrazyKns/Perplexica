import SessionManager from '@/lib/session';
import type { NotionConnectionDb } from '@/lib/connectors/notion/store';
import type { AuthorizedPage } from '@/lib/connectors/notion/types';
import {
  appendPageContent,
  createPage,
  listAuthorizedPages,
  NotionApiError,
  pageUrl,
  updatePageContent,
  WorkspaceParentUnsupportedError,
} from '@/lib/connectors/notion';
import type { WriteConfirmationBlock, WriteConfirmationItem } from '@/lib/types';
import { getStagedWrites } from './staging';
import type {
  StagedWrite,
  WriteConfirmationCollisionOption,
} from './types';

/**
 * Batched write confirmation (ADR-0003, ticket 07).
 *
 * After research, all staged writes for the response are grouped into a
 * single confirmation card. The response pipeline pauses on an
 * interactive, awaitable block until the user approves or rejects the
 * batch (or it times out); only approval executes the writes through the
 * connector. The returned context tells the writer what happened.
 */

export type WriteDecision =
  | {
      action: 'approve';
      resolutions?: Record<string, WriteConfirmationCollisionOption>;
    }
  | { action: 'reject'; reason?: string };

export type WriteOutcome =
  | { outcome: 'none'; context: string }
  | { outcome: 'approved'; context: string }
  | { outcome: 'rejected'; context: string };

const DEFAULT_DECISION_TIMEOUT_MS = 15 * 60 * 1000;
const CONTENT_PREVIEW_LIMIT = 600;

function dedupeById(pages: AuthorizedPage[]): AuthorizedPage[] {
  const seen = new Set<string>();
  const out: AuthorizedPage[] = [];
  for (const page of pages) {
    if (!seen.has(page.id)) {
      seen.add(page.id);
      out.push(page);
    }
  }
  return out;
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Finds an existing page whose title matches a staged create's title —
 * the same-named-page collision that triggers the three-way choice
 * (create-duplicate / write-into-existing / cancel). Pure so it is
 * unit-testable without a database.
 */
export function detectWriteCollisions(
  writes: StagedWrite[],
  knownPages: AuthorizedPage[],
): Map<number, { existingId: string; existingTitle: string }> {
  const byTitle = new Map<string, AuthorizedPage>();
  for (const page of knownPages) {
    const key = normalizeTitle(page.title);
    if (!byTitle.has(key)) byTitle.set(key, page);
  }

  const collisions = new Map<number, { existingId: string; existingTitle: string }>();
  writes.forEach((write, index) => {
    if (write.kind !== 'create') return;
    const existing = byTitle.get(normalizeTitle(write.title));
    if (existing) {
      collisions.set(index, { existingId: existing.id, existingTitle: existing.title });
    }
  });
  return collisions;
}

function toItem(
  write: StagedWrite,
  collision: { existingId: string; existingTitle: string } | undefined,
): WriteConfirmationItem {
  const preview =
    write.content.length > CONTENT_PREVIEW_LIMIT
      ? `${write.content.slice(0, CONTENT_PREVIEW_LIMIT)}…`
      : write.content;

  if (write.kind === 'create') {
    return {
      id: '',
      kind: 'create',
      target: write.parent,
      title: write.title,
      contentPreview: preview,
      ...(collision ? { collision } : {}),
    };
  }

  return {
    id: '',
    kind: write.kind,
    target: write.target,
    title: write.kind === 'update' ? write.title : undefined,
    contentPreview: preview,
  };
}

type ExecutedResult = { ok: boolean; message: string; url?: string };

async function executeOne(
  db: NotionConnectionDb,
  item: WriteConfirmationItem,
  write: StagedWrite,
  resolution: WriteConfirmationCollisionOption | undefined,
): Promise<ExecutedResult> {
  try {
    if (resolution === 'cancel') {
      return { ok: false, message: 'Cancelled by user' };
    }

    if (write.kind === 'append') {
      await appendPageContent(db, write.target.id, write.content);
      return {
        ok: true,
        message: `Appended to "${write.target.title}"`,
        url: pageUrl(write.target.id),
      };
    }

    if (write.kind === 'update') {
      await updatePageContent(db, write.target.id, {
        title: write.title,
        content: write.content,
      });
      return {
        ok: true,
        message: `Updated "${write.target.title}"`,
        url: pageUrl(write.target.id),
      };
    }

    // create — the only kind with a collision choice.
    if (resolution === 'write-into-existing' && item.collision) {
      // Append only — "write into existing" must not rename the page to
      // the proposed create title, as the card promises.
      await updatePageContent(db, item.collision.existingId, {
        content: write.content,
      });
      return {
        ok: true,
        message: `Written into existing page "${item.collision.existingTitle}"`,
        url: pageUrl(item.collision.existingId),
      };
    }

    const created = await createPage(db, {
      parentId: write.parent.id,
      title: write.title,
      content: write.content,
    });
    const placement = write.parent.id
      ? ` under "${write.parent.title}"`
      : ' at the workspace top level';
    return {
      ok: true,
      message: `Created "${write.title}"${placement}`,
      url: created.url,
    };
  } catch (err) {
    if (err instanceof WorkspaceParentUnsupportedError) {
      return { ok: false, message: err.message };
    }
    if (err instanceof NotionApiError) {
      if (err.code === 'not_connected' || err.status === 0) {
        return { ok: false, message: 'Notion is not connected.' };
      }
      return {
        ok: false,
        message: `Notion API error (${err.status}): ${err.message}`,
      };
    }
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

function buildOutcomeContext(items: WriteConfirmationItem[]): string {
  const lines = items.map((item) => {
    const label =
      item.kind === 'append'
        ? 'Append'
        : item.kind === 'update'
          ? 'Update'
          : 'Create';
    return `- [${item.result?.ok ? 'OK' : 'FAILED'}] ${label}: ${item.result?.message ?? 'No result'}${item.result?.url ? ` (${item.result.url})` : ''}`;
  });
  return `<write_confirmation note="The user approved these Notion writes; report the outcome briefly">\n${lines.join('\n')}\n</write_confirmation>`;
}

/**
 * Emits the confirmation card for this response's staged writes, pauses
 * the pipeline for the user's decision, executes (or cancels) the batch,
 * and returns what the writer should say.
 */
export async function runWriteConfirmation(input: {
  session: SessionManager;
  notionDb: NotionConnectionDb;
  notionPages: AuthorizedPage[];
}): Promise<WriteOutcome> {
  const staged = getStagedWrites(input.session);
  if (staged.length === 0) {
    return { outcome: 'none', context: '' };
  }

  // Collision detection: same-named pages among the conversation's
  // selection plus the full authorized set (best-effort API call).
  let authorized: AuthorizedPage[] = [];
  try {
    authorized = await listAuthorizedPages(input.notionDb);
  } catch {
    // Not connected or API error — fall back to the selected pages only.
  }
  const knownPages = dedupeById([...input.notionPages, ...authorized]);
  const collisions = detectWriteCollisions(staged, knownPages);

  const items: WriteConfirmationItem[] = staged.map((write, index) => {
    const item = toItem(write, collisions.get(index));
    item.id = String(index);
    return item;
  });

  const block: WriteConfirmationBlock = {
    id: crypto.randomUUID(),
    type: 'writeConfirmation',
    data: {
      sessionId: input.session.id,
      status: 'pending',
      writes: items,
    },
  };

  input.session.emitBlock(block);

  const decision = (await input.session.waitForDecision(
    block.id,
    DEFAULT_DECISION_TIMEOUT_MS,
  )) as WriteDecision;

  if (decision.action === 'reject') {
    input.session.updateBlock(block.id, [
      { op: 'replace', path: '/data/status', value: 'rejected' },
    ]);
    return {
      outcome: 'rejected',
      context:
        '<write_confirmation>The user rejected the staged Notion writes; nothing was written to Notion.</write_confirmation>',
    };
  }

  const resolutions = decision.resolutions ?? {};

  // Sequential on purpose: parallel writes to the same page can land in a
  // different order than the confirmed batch (appended content would be
  // reordered). Staging order is the batch order.
  const results: ExecutedResult[] = [];
  for (const item of items) {
    const write = staged[Number(item.id)];
    const resolution = item.collision
      ? (resolutions[item.id] ?? 'cancel')
      : undefined;
    results.push(await executeOne(input.notionDb, item, write, resolution));
  }

  items.forEach((item, index) => {
    item.result = results[index];
  });

  const patches: Record<string, unknown>[] = [
    { op: 'replace', path: '/data/status', value: 'approved' },
  ];
  items.forEach((item, index) => {
    patches.push({
      op: 'add',
      path: `/data/writes/${index}/result`,
      value: item.result,
    });
  });
  input.session.updateBlock(block.id, patches);

  return {
    outcome: 'approved',
    context: buildOutcomeContext(items),
  };
}
