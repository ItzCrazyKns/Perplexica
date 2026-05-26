import z from 'zod';
import { ResearchAction } from '../../types';
import { Chunk, ResearchBlock } from '@/lib/types';
import configManager from '@/lib/config';
import { UsptoOdpSource } from '@/lib/agents/priorart/sources/usptoOdp';
import { BigQueryPatentsSource } from '@/lib/agents/priorart/sources/bigqueryPatents';
import { applyDateGuard } from '@/lib/agents/priorart/analysis/dateGuard';
import { familyPrefix } from '@/lib/agents/priorart/retrieval/fuser';
import { PatentDocument, queryPlanSchema } from '@/lib/agents/priorart/schemas';
import { speedModePrompt } from '@/lib/prompts/priorart/speedMode';
import { balancedModePrompt } from '@/lib/prompts/priorart/balancedMode';
import { qualityModePrompt } from '@/lib/prompts/priorart/qualityMode';

const actionSchema = z.object({
  type: z.literal('priorart_search').optional(),
  queries: z
    .array(z.string())
    .describe(
      'Up to 3 patent-style keyword queries. Each is a noun-phrase combo, not a sentence.',
    ),
  cpcClasses: z
    .array(z.string())
    .optional()
    .describe('Optional CPC class prefixes to narrow the search (e.g. "G06F16").'),
  priorityDate: z
    .string()
    .optional()
    .describe('Optional ISO date YYYY-MM-DD; defaults to today. §102 strict-before applied server-side.'),
});

const PER_CALL_LIMIT = 25;

const priorArtSearchAction: ResearchAction<typeof actionSchema> = {
  name: 'priorart_search',
  schema: actionSchema,
  getToolDescription: () =>
    'Search USPTO Open Data Portal and Google Patents BigQuery for prior art relevant to a software feature description. Returns patent documents (title, abstract, first claim, assignees, CPC codes, filing/publication dates). Apply §102 strict-before date guard server-side.',
  getDescription: (config) => {
    switch (config.mode) {
      case 'speed':
        return speedModePrompt;
      case 'balanced':
        return balancedModePrompt;
      case 'quality':
        return qualityModePrompt;
      default:
        return balancedModePrompt;
    }
  },
  enabled: (config) =>
    config.sources.includes('priorart') &&
    config.classification.classification.skipSearch === false,
  execute: async (input, additionalConfig) => {
    const queries = (Array.isArray(input.queries) ? input.queries : [input.queries])
      .filter((q) => typeof q === 'string' && q.trim().length > 0)
      .slice(0, 3);

    if (!queries.length) {
      return { type: 'search_results', results: [] };
    }

    const pa = configManager.getCurrentConfig().priorart ?? {};
    if (!pa.usptoOdpApiKey) {
      console.error('[priorart_search] missing config: usptoOdpApiKey');
      return { type: 'search_results', results: [] };
    }
    const bigqueryEnabled = Boolean(pa.gcpProjectId);

    const priorityDate =
      input.priorityDate ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(priorityDate)) {
      console.error(`[priorart_search] invalid priorityDate: ${priorityDate}`);
      return { type: 'search_results', results: [] };
    }

    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    ) as ResearchBlock | undefined;
    if (researchBlock) {
      researchBlock.data.subSteps.push({
        id: crypto.randomUUID(),
        type: 'searching',
        searching: queries,
      });
      additionalConfig.session.emitBlock(researchBlock);
    }

    const plan = queryPlanSchema.parse({
      odpQueries: queries.map((q) => ({ field: 'any' as const, query: q })),
      bigqueryFragments: queries.map((q) => ({
        whereClause:
          'EXISTS (SELECT 1 FROM UNNEST(title_localized) t WHERE LOWER(t.text) LIKE @' +
          paramNameFor(q) +
          ')',
        params: [
          {
            name: paramNameFor(q),
            type: 'STRING' as const,
            value: `%${q.toLowerCase()}%`,
          },
        ],
      })),
      semanticQueries: queries,
      cpcClasses: input.cpcClasses ?? [],
      priorityDate,
    });

    const odp = new UsptoOdpSource({
      apiKey: pa.usptoOdpApiKey,
      baseUrl: pa.usptoOdpBaseUrl,
      legacyBaseUrl: pa.usptoOdpLegacyBaseUrl,
      oaUseLegacyHost: Boolean(pa.oaUseLegacyHost),
      requestTimeoutMs: Number(pa.requestTimeoutSeconds ?? 30) * 1000,
    });
    const bq = bigqueryEnabled
      ? new BigQueryPatentsSource({
          projectId: pa.gcpProjectId,
          credentialsPath: pa.gcpCredentialsPath || undefined,
          dataset: pa.bigqueryPatentsDataset,
          bytesBilledCap: Number(pa.bigqueryBytesBilledCap ?? 1_000_000_000),
        })
      : null;

    const [odpDocs, bqDocs] = await Promise.all([
      odp.search(plan, PER_CALL_LIMIT).catch((err: Error) => {
        console.error(`[priorart_search] ODP failed: ${err.message}`);
        return [] as PatentDocument[];
      }),
      bq
        ? bq.search(plan, PER_CALL_LIMIT).catch((err: Error) => {
            console.error(`[priorart_search] BigQuery failed: ${err.message}`);
            return [] as PatentDocument[];
          })
        : Promise.resolve([] as PatentDocument[]),
    ]);

    const guarded = [
      ...applyDateGuard(odpDocs, priorityDate),
      ...applyDateGuard(bqDocs, priorityDate),
    ];

    const seenFamily = new Set<string>();
    const deduped: PatentDocument[] = [];
    for (const d of guarded) {
      const fam = familyPrefix(d.publicationNumber);
      if (seenFamily.has(fam)) continue;
      seenFamily.add(fam);
      deduped.push(d);
      if (deduped.length >= PER_CALL_LIMIT) break;
    }

    const results: Chunk[] = deduped.map((d) => toChunk(d));

    if (researchBlock && results.length > 0) {
      researchBlock.data.subSteps.push({
        id: crypto.randomUUID(),
        type: 'reading',
        reading: results,
      });
      additionalConfig.session.emitBlock(researchBlock);
    }

    return { type: 'search_results', results };
  },
};

function toChunk(d: PatentDocument): Chunk {
  const content = [d.title, d.abstract, d.firstIndependentClaim]
    .filter((s) => typeof s === 'string' && s.length > 0)
    .join('\n\n');
  const slug = d.publicationNumber.replaceAll('-', '');
  return {
    content,
    metadata: {
      title: d.title,
      url: `https://patents.google.com/patent/${slug}`,
      publicationNumber: d.publicationNumber,
      applicationNumber: d.applicationNumber,
      assignees: d.assignees,
      inventors: d.inventors,
      cpcCodes: d.cpcCodes,
      filingDate: d.filingDate,
      publicationDate: d.publicationDate,
      source: d.source,
    },
  };
}

function paramNameFor(q: string): string {
  const hash = Array.from(q).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  return 't' + Math.abs(hash).toString(36);
}

export default priorArtSearchAction;
