import { runPriorArt } from '@/lib/agents/priorart/orchestrator';
import { buildOrchestratorConfig } from '@/lib/agents/priorart/runtime';

type Body = {
  featureDescription: string;
  priorityDate?: string;
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
        priorityDate: body.priorityDate,
        mode: 'landscape',
        benchmarkDeltas: body.benchmarkDeltas,
      },
      cfg,
    );
    return Response.json(result, { status: 200 });
  } catch (err: any) {
    console.error(`[priorart/landscape] ${err.message}`);
    return Response.json(
      { message: err.message ?? 'Prior art run failed.' },
      { status: 500 },
    );
  }
};
