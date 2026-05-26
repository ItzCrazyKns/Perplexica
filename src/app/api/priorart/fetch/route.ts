import configManager from '@/lib/config';
import { UsptoOdpSource } from '@/lib/agents/priorart/sources/usptoOdp';
import { BigQueryPatentsSource } from '@/lib/agents/priorart/sources/bigqueryPatents';

type Body = {
  identifier: string;
};

export const POST = async (req: Request) => {
  try {
    const body = (await req.json()) as Body;
    if (!body.identifier) {
      return Response.json({ message: 'identifier is required' }, { status: 400 });
    }
    const pa = configManager.getCurrentConfig().priorart ?? {};
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

    const tryOrder = body.identifier.match(/^\d/) ? [odp, bq] : [bq, odp];
    for (const src of tryOrder) {
      try {
        const doc = await src.fetch(body.identifier);
        if (doc) return Response.json({ document: doc }, { status: 200 });
      } catch (e: any) {
        console.error(`[priorart/fetch] ${src.name} ${e.message}`);
      }
    }
    return Response.json({ document: null }, { status: 404 });
  } catch (err: any) {
    console.error(`[priorart/fetch] ${err.message}`);
    return Response.json(
      { message: err.message ?? 'Fetch failed.' },
      { status: 500 },
    );
  }
};
