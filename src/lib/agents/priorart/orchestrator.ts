import fs from 'node:fs';
import path from 'node:path';
import BaseLLM from '@/lib/models/base/llm';
import BaseEmbedding from '@/lib/models/base/embedding';
import {
  FeatureProfile,
  LabeledTechnicalElement,
  MemoSkeleton,
  MEMO_DISCLAIMER,
  PatentDocument,
  QueryPlan,
  RankedDocument,
  memoSkeletonSchema,
} from './schemas';
import { computeCoverage } from './analysis/coverage';
import { filterByDomain } from './analysis/semanticFilter';
import { deepResearchReframe, ReframeResult } from './analysis/deepResearchReframe';
import { distillEdges, PatentableEdge } from './analysis/edgeDistillation';
import { UsptoOdpSource, UsptoOdpConfig } from './sources/usptoOdp';
import { BigQueryPatentsSource, BigQueryPatentsConfig } from './sources/bigqueryPatents';
import { PriorArtSource } from './sources/base';
import { planQueries } from './retrieval/queryPlanner';
import { PriorArtEmbeddings } from './retrieval/embeddings';
import { reciprocalRankFuse, familyPrefix } from './retrieval/fuser';
import { parseFeature } from './analysis/featureParser';
import { applyDateGuard } from './analysis/dateGuard';
import { synthesizeLandscape } from './analysis/landscape';
import { buildClaimChart } from './analysis/claimChart';
import { extractCitations, stripUnverified } from './analysis/verifier';
import { renderMemoMarkdown } from './render';
import { loadPrompt, renderPrompt } from './prompts';

export type OrchestratorInputs = {
  featureDescription: string;
  claimText?: string;
  priorityDate?: string;
  benchmarkDeltas?: string;
  mode?: 'clear' | 'landscape';
};

export type OrchestratorConfig = {
  llm: BaseLLM<unknown>;
  embedder: BaseEmbedding<unknown>;
  uspto: UsptoOdpConfig;
  bigquery?: BigQueryPatentsConfig;
  workspaceRoot: string;
  vectorStoreRoot: string;
  maxResultsPerSource: number;
  maxDocumentsToEmbed: number;
  embeddingDimension: number;
  topK: number;
  coverageThreshold: number;
  enableDeepResearchReframe?: boolean;
  deepResearchReframeModel?: string;
  geminiApiKey?: string;
};

export type OrchestratorOutput = {
  workspaceId: string;
  workspaceDir: string;
  memo: MemoSkeleton;
  markdownPath: string;
  jsonPath: string;
  claimChartPath: string | null;
  warnings: string[];
};

export async function runPriorArt(
  inputs: OrchestratorInputs,
  cfg: OrchestratorConfig,
): Promise<OrchestratorOutput> {
  const priorityDate = inputs.priorityDate ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(priorityDate)) {
    throw new Error(`Invalid priority date: ${priorityDate}`);
  }

  // Step 0b: Gemini Deep Research reframe. Grounded web search disambiguates
  // collision-prone terms ("switchyard"=electrical substation) and produces
  // refined keywords, CPCs, noise-domain list, and non-patent prior art. The
  // downstream search uses these refinements to avoid the keyword-pollution
  // failure mode (Hitachi/Samsung SDI/Kawasaki matches).
  let reframe: ReframeResult | null = null;
  if (cfg.enableDeepResearchReframe !== false && cfg.geminiApiKey) {
    console.log('[priorart] step0b: deepResearchReframe (Gemini grounded search)');
    reframe = await deepResearchReframe(inputs.featureDescription, {
      apiKey: cfg.geminiApiKey,
      model: cfg.deepResearchReframeModel,
    }).catch((e: Error) => {
      console.error(`[priorart] step0b reframe failed (continuing without): ${e.message}`);
      return null;
    });
    if (reframe) {
      console.log(
        `[priorart] step0b OK: ${reframe.trueTechnicalPillars.length} pillars, ` +
          `${reframe.refinedUsptoQueries.length} refined queries, ` +
          `${reframe.noiseDomainsToAvoid.length} noise domains, ` +
          `${reframe.nonPatentPriorArt.length} non-patent refs`,
      );
    }
  }

  console.log('[priorart] step1: parseFeature');
  const profile: FeatureProfile = await parseFeature(
    cfg.llm,
    inputs.featureDescription,
    reframe?.trueTechnicalPillars.map((p) => p.pillar),
  ).catch((e) => {
    throw new Error(`step1 parseFeature: ${e.message}`);
  });
  console.log(`[priorart] step1 OK: ${profile.technicalElements.length} elements`);

  // Auto-assign stable element labels server-side (E1, E2, ...) so the LLM
  // never controls identity. Used by coverage matrix + primary-ref join.
  const labeledElements: LabeledTechnicalElement[] = profile.technicalElements.map(
    (el, i) => ({ ...el, label: `E${i + 1}` }),
  );

  console.log('[priorart] step2: planQueries');
  let plan: QueryPlan = await planQueries(
    cfg.llm,
    profile,
    inputs.claimText,
    priorityDate,
    reframe?.refinedUsptoQueries,
  ).catch((e) => {
    throw new Error(`step2 planQueries: ${e.message}`);
  });
  // Substitute reframe-refined CPCs if the LLM emitted none (or only the
  // generic whitelist defaults). Reframe's CPCs are domain-specific.
  if (reframe?.refinedCpcClasses.length && plan.cpcClasses.length <= 2) {
    plan = { ...plan, cpcClasses: reframe.refinedCpcClasses };
  }
  console.log(`[priorart] step2 OK: ${plan.odpQueries.length} ODP queries`);

  console.log('[priorart] step3: instantiate sources');
  const sources: PriorArtSource[] = [new UsptoOdpSource(cfg.uspto)];
  if (cfg.bigquery) sources.push(new BigQueryPatentsSource(cfg.bigquery));
  console.log(`[priorart] step3: ${sources.length} sources, running searches`);
  const sourceResults = await Promise.all(
    sources.map((s) =>
      s.search(plan, cfg.maxResultsPerSource).catch((err: Error) => {
        console.error(`[priorart] ${s.name} search failed: ${err.message}`);
        return [] as PatentDocument[];
      }),
    ),
  );
  console.log(`[priorart] step3 results: ${sourceResults.map((r) => r.length).join(', ')}`);
  const odpDocs = applyDateGuard(sourceResults[0], priorityDate);
  const bqDocs = applyDateGuard(sourceResults[1] ?? [], priorityDate);
  console.log(`[priorart] step3 date-guarded: odp=${odpDocs.length} bq=${bqDocs.length}`);

  const pool: PatentDocument[] = [];
  const seenFamily = new Set<string>();
  for (const d of [...odpDocs, ...bqDocs]) {
    const fam = familyPrefix(d.publicationNumber);
    if (seenFamily.has(fam)) continue;
    seenFamily.add(fam);
    pool.push(d);
  }
  console.log(`[priorart] step3 deduped pool: ${pool.length}`);
  const embedPool = pool.slice(0, cfg.maxDocumentsToEmbed);
  const workspaceId = profile.featureId + '-' + nowStamp();
  const vectorStorePath = path.join(cfg.vectorStoreRoot, `${workspaceId}.db`);
  console.log(`[priorart] step3 workspace: ${workspaceId} vec=${vectorStorePath}`);
  let store: PriorArtEmbeddings;
  try {
    store = new PriorArtEmbeddings({
      storePath: vectorStorePath,
      embedder: cfg.embedder,
      embeddingDimension: cfg.embeddingDimension,
      workspaceId,
    });
    console.log('[priorart] step3 store constructed OK');
  } catch (e: any) {
    console.error(`[priorart] step3 store construction failed: ${e.stack ?? e.message}`);
    throw new Error(`step3 store: ${e.message}`);
  }
  try {
    console.log(`[priorart] step4a: ingest ${embedPool.length} docs`);
    await store.ingest(embedPool).catch((e) => {
      console.error(`[priorart] step4a ingest failed: ${e.stack ?? e.message}`);
      throw new Error(`step4a ingest: ${e.message}`);
    });
    console.log('[priorart] step4b: semantic recall');
    const semanticHits = await Promise.all(
      plan.semanticQueries.map((q, i) =>
        store.query(q, cfg.topK).catch((e: Error) => {
          console.error(`[priorart] step4b query[${i}] "${q}" failed: ${e.stack ?? e.message}`);
          return [];
        }),
      ),
    );
    console.log(`[priorart] step4b OK: ${semanticHits.flat().length} semantic hits`);
    const semanticRanking = aggregateSemantic(semanticHits);

    const fused: RankedDocument[] = reciprocalRankFuse(
      pool,
      [
        { signal: 'odp', ranking: odpDocs.map((d) => d.publicationNumber) },
        { signal: 'bigquery', ranking: bqDocs.map((d) => d.publicationNumber) },
        { signal: 'semantic', ranking: semanticRanking },
      ],
      cfg.topK,
    );
    console.log(`[priorart] step4c fused: ${fused.length} ranked docs`);

    console.log(`[priorart] step3-4 OK: ${pool.length} pooled, ${fused.length} fused`);

    // Semantic domain filter: LLM-reasoned drop of refs that share keywords
    // with the feature but live in unrelated technical domains (the classic
    // "switchyard → electrical substation" / "state management → solid-state
    // battery" failure mode). Runs ONE LLM call over the top-K, fail-open.
    console.log('[priorart] step4d: semantic domain filter');
    const filterResult = await filterByDomain(cfg.llm, profile, fused, {
      noiseDomainsToAvoid: reframe?.noiseDomainsToAvoid,
    }).catch((e: Error) => {
      console.error(`[priorart] step4d filter failed: ${e.stack ?? e.message}`);
      return { kept: fused, dropped: [] };
    });
    const filteredFused = filterResult.kept;
    const domainFilterWarnings = filterResult.dropped.map(
      (d) => `Filtered ${d.doc.publicationNumber} (off-domain): ${d.reason}`,
    );
    console.log(
      `[priorart] step4d OK: kept ${filteredFused.length}/${fused.length} ` +
        `(dropped ${filterResult.dropped.length} off-domain)`,
    );

    console.log('[priorart] step5: synthesizeLandscape');
    const landscape = await synthesizeLandscape(cfg.llm, profile, filteredFused).catch((e) => {
      throw new Error(`step5 synthesizeLandscape: ${e.message}`);
    });
    console.log(`[priorart] step5 OK: ${landscape.topAssignees.length} assignees`);

    console.log('[priorart] step5c: per-element coverage matrix');
    const coverage = await computeCoverage(labeledElements, filteredFused, cfg.embedder, {
      threshold: cfg.coverageThreshold,
    }).catch((e: Error) => {
      console.error(`[priorart] step5c coverage failed: ${e.stack ?? e.message}`);
      return { elementCoverage: [], primaryReference: null };
    });
    console.log(
      `[priorart] step5c OK: ${coverage.elementCoverage.length} elements scored, ` +
        `primaryRef=${coverage.primaryReference?.publicationNumber ?? 'none'}`,
    );

    // Step 6b: per-pillar patentable-edge distillation. Runs only when reframe
    // surfaced pillars + we have a Gemini key. Output feeds the new "## 6.
    // Patentable Edges" memo section — claim-drafting-prep rather than just
    // clearance-prep.
    let patentableEdges: PatentableEdge[] = [];
    if (reframe && cfg.geminiApiKey && reframe.trueTechnicalPillars.length) {
      console.log('[priorart] step6b: patentable-edge distillation');
      patentableEdges = await distillEdges(
        profile.summary,
        reframe,
        { apiKey: cfg.geminiApiKey, model: cfg.deepResearchReframeModel },
        { benchmarkDeltas: inputs.benchmarkDeltas },
      ).catch((e: Error) => {
        console.error(`[priorart] step6b distillEdges failed: ${e.message}`);
        return [];
      });
      console.log(
        `[priorart] step6b OK: ${patentableEdges.length} edges (${
          patentableEdges.filter((e) => e.strength === 'strong').length
        } strong)`,
      );
    }

    const includeClaim = inputs.mode !== 'landscape' && inputs.claimText;
    const claimChart = includeClaim
      ? await buildClaimChart(cfg.llm, inputs.claimText!, filteredFused).catch((e) => {
          throw new Error(`step5b buildClaimChart: ${e.message}`);
        })
      : null;

    const retrievedSet = new Set(pool.map((d) => d.publicationNumber.replace('-', '')));
    const warnings: string[] = [];
    const verifyAgainstSet = (text: string) => {
      const cites = extractCitations(text);
      const unverified: string[] = [];
      for (const c of cites) {
        if (!retrievedSet.has(c)) unverified.push(c);
      }
      return unverified;
    };

    let memoDraft: MemoSkeleton = memoSkeletonSchema.parse({
      featureDescription: profile.summary,
      searchStrategy: {
        cpcClasses: plan.cpcClasses,
        keywordClusters: profile.keywordClusters.map((k) => k.label),
        priorityDate,
        sources: cfg.bigquery
          ? ['USPTO ODP', 'Google Patents BigQuery']
          : ['USPTO ODP'],
      },
      landscapeFindings: landscape,
      referencesOfInterest: filteredFused.slice(0, 10).map((r) => ({
        publicationNumber: r.publicationNumber,
        title: r.title,
        relevanceNote: `Fused score ${r.fusedScore.toFixed(4)}; sources: ${Object.keys(r.sourceRanks).join(', ')}`,
      })),
      reframe: reframe,
      elementCoverage: coverage.elementCoverage,
      primaryReference: coverage.primaryReference,
      patentableEdges,
      claimChart,
      openQuestionsForCounsel: [],
      verificationWarnings: [],
    });

    // Surface semantic-filter drops in the memo warnings so they appear in the UI.
    if (domainFilterWarnings.length) {
      warnings.push(...domainFilterWarnings);
      memoDraft.verificationWarnings = warnings;
    }

    const draftJson = JSON.stringify(memoDraft);
    const unverified = verifyAgainstSet(draftJson);
    if (unverified.length) {
      memoDraft = stripUnverified(memoDraft, unverified);
      warnings.push(
        ...unverified.map((c) => `Stripped unverified citation: ${c}`),
      );
      memoDraft.verificationWarnings = warnings;
    }

    // Step 6: memo is the structured draft + LLM-generated open questions only
    // (full-memo synthesis was hitting Gemini's 8K output cap on Switchyard-size
    // inputs; the draft is already complete from structured retrieval).
    const openQuestions = await generateOpenQuestions(cfg.llm, profile, memoDraft).catch(
      (err: Error) => {
        warnings.push(`Open-questions generation failed: ${err.message}`);
        return [];
      },
    );
    const memo: MemoSkeleton = {
      ...memoDraft,
      openQuestionsForCounsel: openQuestions,
      verificationWarnings: warnings,
    };

    // Step 7: persist artifacts
    const dir = path.join(cfg.workspaceRoot, profile.featureId, nowStamp());
    fs.mkdirSync(dir, { recursive: true });
    const markdownPath = path.join(dir, 'memo.md');
    const jsonPath = path.join(dir, 'memo.json');
    const claimChartPath = memo.claimChart ? path.join(dir, 'claim_chart.md') : null;
    fs.writeFileSync(markdownPath, renderMemoMarkdown(memo));
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({ profile, plan, fused, memo, warnings }, null, 2),
    );
    if (claimChartPath && memo.claimChart) {
      fs.writeFileSync(
        claimChartPath,
        `> ${MEMO_DISCLAIMER}\n\n${renderClaimChartLite(memo.claimChart)}\n\n> ${MEMO_DISCLAIMER}`,
      );
    }

    return {
      workspaceId,
      workspaceDir: dir,
      memo,
      markdownPath,
      jsonPath,
      claimChartPath,
      warnings,
    };
  } finally {
    store.close();
  }
}

import z from 'zod';

const openQuestionsSchema = z.object({
  openQuestionsForCounsel: z
    .array(z.string())
    .min(2)
    .max(8)
    .describe('Concrete, narrow questions counsel should answer next.'),
});

async function generateOpenQuestions(
  llm: BaseLLM<unknown>,
  profile: FeatureProfile,
  draft: MemoSkeleton,
): Promise<string[]> {
  const system = loadPrompt('system');
  const user = `For the feature and landscape below, generate 3-6 concrete questions counsel should answer next. Questions should be specific (cite assignees, references, or technical elements), not legal opinions. Examples: "verify continuity chain for US-XXXXXXXX-A1", "confirm whether Acme's portfolio includes additional unpublished applications in G06F16".

Feature: ${profile.summary}

Top assignees: ${draft.landscapeFindings.topAssignees.map((a) => `${a.name} (${a.count})`).join(', ')}
References of interest: ${draft.referencesOfInterest.map((r) => r.publicationNumber).join(', ')}
Whitespace candidates: ${draft.landscapeFindings.whitespaceCandidates.join('; ')}`;
  const out = await llm.generateObject<typeof openQuestionsSchema>({
    schema: openQuestionsSchema,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    options: { temperature: 0.3, maxTokens: 2048 },
  });
  return openQuestionsSchema.parse(out).openQuestionsForCounsel;
}

function nowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function aggregateSemantic(hits: { publicationNumber: string; distance: number }[][]): string[] {
  const aggregate = new Map<string, number>();
  hits.forEach((h, qIdx) => {
    h.forEach((row, idx) => {
      const rank = qIdx * 1000 + idx;
      const prev = aggregate.get(row.publicationNumber);
      if (prev === undefined || rank < prev) aggregate.set(row.publicationNumber, rank);
    });
  });
  return [...aggregate.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([pub]) => pub);
}

function renderClaimChartLite(chart: import('./schemas').ClaimChart): string {
  const out: string[] = ['| Element | Reference | Pinpoint |', '|---|---|---|'];
  for (const e of chart.elements) {
    const ms = chart.mappings.filter((m) => m.elementLabel === e.label);
    if (!ms.length) {
      out.push(`| ${e.label}: ${e.text.replaceAll('|', '\\|')} | (no mapping) | |`);
      continue;
    }
    for (const m of ms) {
      out.push(`| ${e.label}: ${e.text.replaceAll('|', '\\|')} | ${m.referencePublicationNumber} | ${m.pinpoint} |`);
    }
  }
  return out.join('\n');
}
