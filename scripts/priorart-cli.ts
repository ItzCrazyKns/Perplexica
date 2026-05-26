#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { runPriorArt } from '@/lib/agents/priorart/orchestrator';
import { buildOrchestratorConfig } from '@/lib/agents/priorart/runtime';
import configManager from '@/lib/config';
import { UsptoOdpSource } from '@/lib/agents/priorart/sources/usptoOdp';
import { BigQueryPatentsSource } from '@/lib/agents/priorart/sources/bigqueryPatents';
import { applyDateGuard } from '@/lib/agents/priorart/analysis/dateGuard';
import { queryPlanSchema } from '@/lib/agents/priorart/schemas';

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): { command: string; args: Args } {
  const [, , command, ...rest] = argv;
  const args: Args = {};
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i];
    if (!tok.startsWith('--')) continue;
    const key = tok.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return { command, args };
}

function read(p: string): string {
  return fs.readFileSync(path.resolve(p), 'utf-8');
}

async function cmdClear(args: Args, mode: 'clear' | 'landscape') {
  const featureFile = args['feature-file'] as string;
  if (!featureFile) die('Missing --feature-file');
  const claimFile = args['claim-file'] as string | undefined;
  const priorityDate = args['priority-date'] as string | undefined;

  const cfg = await buildOrchestratorConfig();
  const result = await runPriorArt(
    {
      featureDescription: read(featureFile),
      claimText: claimFile ? read(claimFile) : undefined,
      priorityDate,
      mode,
    },
    cfg,
  );

  console.log(`Workspace: ${result.workspaceDir}`);
  console.log(`Markdown:  ${result.markdownPath}`);
  console.log(`JSON:      ${result.jsonPath}`);
  if (result.claimChartPath) console.log(`Chart:     ${result.claimChartPath}`);
  if (result.warnings.length) {
    console.log(`\nVerification warnings:`);
    for (const w of result.warnings) console.log(`  - ${w}`);
  }
}

async function cmdSearch(args: Args) {
  const query = args.query as string;
  if (!query) die('Missing --query');
  const cpcRaw = (args.cpc as string) ?? '';
  const cpcClasses = cpcRaw ? cpcRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const limit = Number(args.limit ?? 25);
  const priorityDate =
    (args['priority-date'] as string) ?? new Date().toISOString().slice(0, 10);

  const pa = configManager.getCurrentConfig().priorart ?? {};
  const plan = queryPlanSchema.parse({
    odpQueries: [{ field: 'any', query }],
    bigqueryFragments: [
      {
        whereClause:
          'EXISTS (SELECT 1 FROM UNNEST(title_localized) t WHERE LOWER(t.text) LIKE @term)',
        params: [{ name: 'term', type: 'STRING', value: `%${query.toLowerCase()}%` }],
      },
    ],
    semanticQueries: [query],
    cpcClasses,
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
      console.error(`[odp] ${e.message}`);
      return [];
    }),
    bq.search(plan, limit).catch((e) => {
      console.error(`[bq] ${e.message}`);
      return [];
    }),
  ]);
  const docs = [...applyDateGuard(odpDocs, priorityDate), ...applyDateGuard(bqDocs, priorityDate)];
  console.log(JSON.stringify(docs, null, 2));
}

async function cmdFetch(args: Args) {
  const id = (args.publication as string) ?? (args.identifier as string);
  if (!id) die('Missing --publication');
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
  for (const src of [odp, bq]) {
    try {
      const doc = await src.fetch(id);
      if (doc) {
        console.log(JSON.stringify(doc, null, 2));
        return;
      }
    } catch (e: any) {
      console.error(`[${src.name}] ${e.message}`);
    }
  }
  die(`No document found for ${id}`);
}

function die(msg: string): never {
  console.error(msg);
  console.error(
    '\nUsage:\n  priorart-cli clear --feature-file <path> [--claim-file <path>] [--priority-date YYYY-MM-DD]\n  priorart-cli landscape --feature-file <path> [--priority-date YYYY-MM-DD]\n  priorart-cli search --query "..." [--cpc G06F16,G06N20] [--limit 50] [--priority-date YYYY-MM-DD]\n  priorart-cli fetch --publication US-XXXXXXXX',
  );
  process.exit(1);
}

async function main() {
  const { command, args } = parseArgs(process.argv);
  switch (command) {
    case 'clear':
      await cmdClear(args, 'clear');
      break;
    case 'landscape':
      await cmdClear(args, 'landscape');
      break;
    case 'search':
      await cmdSearch(args);
      break;
    case 'fetch':
      await cmdFetch(args);
      break;
    default:
      die(`Unknown command: ${command ?? '(none)'}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
