import { z } from 'zod';
import SessionManager from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resolves a pending batched write confirmation (ADR-0003). The chat
 * stream paused on an interactive block; the UI calls this when the user
 * approves or rejects, and the pipeline resumes.
 */

const bodySchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  blockId: z.string().min(1, 'blockId is required'),
  decision: z.object({
    action: z.enum(['approve', 'reject']),
    resolutions: z
      .record(
        z.string(),
        z.enum(['create-duplicate', 'write-into-existing', 'cancel']),
      )
      .optional(),
  }),
});

export const POST = async (req: Request) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        message: 'Invalid request body',
        error: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const { sessionId, blockId, decision } = parsed.data;

  const session = SessionManager.getSession(sessionId);
  if (!session) {
    return Response.json(
      { message: 'Session not found or expired' },
      { status: 404 },
    );
  }

  const resolved = session.resolveDecision(blockId, decision);
  if (!resolved) {
    return Response.json(
      { message: 'No pending confirmation for this block' },
      { status: 404 },
    );
  }

  return Response.json({ ok: true });
};
