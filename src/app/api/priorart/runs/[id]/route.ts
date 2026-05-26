import db from '@/lib/db';
import { priorartWorkspaces } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET = async (
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await ctx.params;
    const rows = await db
      .select()
      .from(priorartWorkspaces)
      .where(eq(priorartWorkspaces.id, id))
      .limit(1);
    if (!rows.length) {
      return Response.json({ message: 'run not found' }, { status: 404 });
    }
    const r = rows[0];

    // Stale detection: row says running but lastUpdatedAt > 2 min ago →
    // orchestrator died (container restart, OOM). Surface to UI so it can
    // stop polling and show a recoverable error.
    let inferredStatus = r.status;
    let staleReason: string | undefined;
    if (r.status === 'running' && r.lastUpdatedAt) {
      const idleMs = Date.now() - new Date(r.lastUpdatedAt).getTime();
      if (idleMs > 2 * 60 * 1000) {
        inferredStatus = 'error' as const;
        staleReason = `Run appears interrupted — no progress for ${Math.round(idleMs / 1000)}s. The container may have restarted.`;
      }
    }

    return Response.json(
      {
        id: r.id,
        status: inferredStatus,
        lastStep: r.lastStep,
        progress: r.progress ?? 0,
        errorMessage: r.errorMessage ?? staleReason ?? null,
        createdAt: r.createdAt,
        lastUpdatedAt: r.lastUpdatedAt,
        featureId: r.featureId,
        title: r.title,
        markdownPath: r.markdownPath,
        jsonPath: r.jsonPath,
        claimChartPath: r.claimChartPath,
        warnings: r.warnings ?? [],
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error(`[priorart/runs/${'[id]'}] ${err.message}`);
    return Response.json({ message: err.message }, { status: 500 });
  }
};
