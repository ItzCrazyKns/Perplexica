/**
 * Staged Notion writes (ADR-0003).
 *
 * Agent write tools never execute a write — they stage it into the
 * response's session. After research completes, all staged writes for
 * that response are grouped into one confirmation card; only the user's
 * approval executes them.
 */

export type StagedWrite =
  | {
      kind: 'append';
      target: { id: string; title: string };
      content: string;
    }
  | {
      kind: 'update';
      target: { id: string; title: string };
      title?: string;
      content: string;
    }
  | {
      kind: 'create';
      parent: { id: string | null; title: string };
      title: string;
      content: string;
    };

/** The three-way choice offered when a same-named page already exists. */
export type WriteConfirmationCollisionOption =
  | 'create-duplicate'
  | 'write-into-existing'
  | 'cancel';
