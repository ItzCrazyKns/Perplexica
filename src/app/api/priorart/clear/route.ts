import { runPriorArt } from '@/lib/agents/priorart/orchestrator';
import { buildOrchestratorConfig } from '@/lib/agents/priorart/runtime';
import db from '@/lib/db';
import { priorartWorkspaces } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

type Body = {
  featureDescription: string;
  claimText?: string;
  priorityDate?: string;
  mode?: 'clear' | 'landscape';
  chatProviderId?: string;
  chatModelKey?: string;
  benchmarkDeltas?: string;
};

export const POST = async (req: Request) => {
  try {
    const body = (await req.json()) as Body;
    if (!body.featureDescription || body.featureDescription.trim().length < 20) {
      return Response.json(
        { message: 'featureDescription must be at least 20 characters.' },
        { status: 400 },
      );
    }

    // Create run row up-front so the UI has a runId to poll IMMEDIATELY.
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const priorityDate =
      body.priorityDate ?? new Date().toISOString().slice(0, 10);
    const title = body.featureDescription.slice(0, 200);

    await db.insert(priorartWorkspaces).values({
      id: runId,
      featureId: 'pending',
      title,
      priorityDate,
      claimText: body.claimText ?? null,
      status: 'running',
      createdAt: now,
      lastStep: 'queued',
      progress: 0,
      lastUpdatedAt: now,
      warnings: [],
    });

    // Kick the orchestrator in the background; do NOT await. Next.js keeps
    // the event loop alive after Response returns so the Promise runs to
    // completion. The DB row is the single source of truth for progress.
    runInBackground(runId, body, priorityDate);

    return Response.json({ runId, status: 'running' }, { status: 202 });
  } catch (err: any) {
    console.error(`[priorart/clear] init error: ${err.message}`);
    return Response.json(
      { message: err.message ?? 'Prior art run failed to start.' },
      { status: 500 },
    );
  }
};

async function runInBackground(
  runId: string,
  body: Body,
  priorityDate: string,
): Promise<void> {
  const update = async (patch: Record<string, unknown>) => {
    try {
      await db
        .update(priorartWorkspaces)
        .set({ ...patch, lastUpdatedAt: new Date().toISOString() })
        .where(eq(priorartWorkspaces.id, runId));
    } catch (e: any) {
      console.error(`[priorart/${runId}] db update failed: ${e.message}`);
    }
  };

  try {
    const cfg = await buildOrchestratorConfig({
      chatProviderId: body.chatProviderId,
      chatModelKey: body.chatModelKey,
    });

    const result = await runPriorArt(
      {
        featureDescription: body.featureDescription,
        claimText: body.claimText,
        priorityDate: body.priorityDate,
        mode: body.mode ?? 'clear',
        benchmarkDeltas: body.benchmarkDeltas,
      },
      {
        ...cfg,
        onProgress: ({ step, progress, detail }) => {
          // Fire-and-forget; we don't block the orchestrator on the DB write.
          update({
            lastStep: detail ? `${step} — ${detail}` : step,
            progress,
          }).catch(() => {});
        },
      },
    );

    await update({
      featureId: result.memo.featureDescription.slice(0, 60),
      title: result.memo.featureDescription.slice(0, 200),
      status: 'completed',
      lastStep: 'completed',
      progress: 100,
      markdownPath: result.markdownPath,
      jsonPath: result.jsonPath,
      claimChartPath: result.claimChartPath,
      warnings: result.warnings,
    });
  } catch (err: any) {
    console.error(`[priorart/${runId}] failed: ${err.stack ?? err.message}`);
    await update({
      status: 'error',
      lastStep: 'error',
      errorMessage: err.message ?? 'unknown error',
    });
  }
}
