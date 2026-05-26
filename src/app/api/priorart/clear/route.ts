import { runPriorArt } from '@/lib/agents/priorart/orchestrator';
import { buildOrchestratorConfig } from '@/lib/agents/priorart/runtime';
import db from '@/lib/db';
import { priorartWorkspaces } from '@/lib/db/schema';

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
      cfg,
    );

    await db.insert(priorartWorkspaces).values({
      id: result.workspaceId,
      featureId: result.memo.featureDescription.slice(0, 60),
      title: result.memo.featureDescription.slice(0, 200),
      priorityDate: result.memo.searchStrategy.priorityDate,
      claimText: body.claimText ?? null,
      status: 'completed',
      createdAt: new Date().toISOString(),
      markdownPath: result.markdownPath,
      jsonPath: result.jsonPath,
      claimChartPath: result.claimChartPath,
      warnings: result.warnings,
    });

    return Response.json(result, { status: 200 });
  } catch (err: any) {
    console.error(`[priorart/clear] ${err.message}\n${err.stack ?? ''}`);
    return Response.json(
      { message: err.message ?? 'Prior art run failed.' },
      { status: 500 },
    );
  }
};
