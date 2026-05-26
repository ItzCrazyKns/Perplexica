import configManager from '@/lib/config';
import { UsptoOdpSource } from '@/lib/agents/priorart/sources/usptoOdp';
import { BigQueryPatentsSource } from '@/lib/agents/priorart/sources/bigqueryPatents';
import { applyDateGuard } from '@/lib/agents/priorart/analysis/dateGuard';
import { queryPlanSchema } from '@/lib/agents/priorart/schemas';

type Body = {
  query: string;
  cpcClasses?: string[];
  limit?: number;
  priorityDate?: string;
};

export const POST = async (req: Request) => {
  try {
    const body = (await req.json()) as Body;
    if (!body.query) {
      return Response.json({ message: 'query is required' }, { status: 400 });
    }
    const pa = configManager.getCurrentConfig().priorart ?? {};
    if (!pa.usptoOdpApiKey || !pa.gcpProjectId) {
      return Response.json(
        { message: 'Prior Art mode is missing required config.' },
        { status: 400 },
      );
    }
    const priorityDate = body.priorityDate ?? new Date().toISOString().slice(0, 10);
    const limit = Math.min(Math.max(body.limit ?? 25, 1), 200);
    const plan = queryPlanSchema.parse({
      odpQueries: [{ field: 'any', query: body.query }],
      bigqueryFragments: [
        {
          whereClause:
            'EXISTS (SELECT 1 FROM UNNEST(title_localized) t WHERE LOWER(t.text) LIKE @term)',
          params: [
            { name: 'term', type: 'STRING', value: `%${body.query.toLowerCase()}%` },
          ],
        },
      ],
      semanticQueries: [body.query],
      cpcClasses: body.cpcClasses ?? [],
      priorityDate,
    });
    const odp = new UsptoOdpSource({
      apiKey: pa.usptoOdpApiKey,
      baseUrl: pa.usptoOdpBaseUrl,
      legacyBaseUrl: pa.usptoOdpLegacyBaseUrl,
      oaUseLegacyHost: Boolean(pa.oaUseLegacyHost),
      requestTimeoutMs: Number(pa.requestTimeoutSeconds ?? 30) * 1000,
    });
    const bq = new BigQueryPatentsSource({
      projectId: pa.gcpProjectId,
      credentialsPath: pa.gcpCredentialsPath || undefined,
      dataset: pa.bigqueryPatentsDataset,
      bytesBilledCap: Number(pa.bigqueryBytesBilledCap ?? 1_000_000_000),
    });

    const [odpDocs, bqDocs] = await Promise.all([
      odp.search(plan, limit).catch((e) => {
        console.error(`[priorart/search] odp ${e.message}`);
        return [];
      }),
      bq.search(plan, limit).catch((e) => {
        console.error(`[priorart/search] bq ${e.message}`);
        return [];
      }),
    ]);
    const docs = [...applyDateGuard(odpDocs, priorityDate), ...applyDateGuard(bqDocs, priorityDate)];
    return Response.json({ documents: docs }, { status: 200 });
  } catch (err: any) {
    console.error(`[priorart/search] ${err.message}`);
    return Response.json(
      { message: err.message ?? 'Search failed.' },
      { status: 500 },
    );
  }
};
