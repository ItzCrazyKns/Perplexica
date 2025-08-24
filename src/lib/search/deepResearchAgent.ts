import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import { EventEmitter } from 'events';
import { deepPlannerTool } from '@/lib/tools/agents/deepPlannerTool';
import {
  expandedSearchTool,
  type Candidate,
} from '@/lib/tools/agents/expandedSearchTool';
import {
  readerExtractorTool,
  type ExtractedDoc,
} from '@/lib/tools/agents/readerExtractorTool';
import { clusterCompressTool } from '@/lib/tools/agents/clusterCompressTool';
import { deepSynthesizerTool } from '@/lib/tools/agents/deepSynthesizerTool';
import {
  evidenceStoreTool,
  type EvidenceItem,
} from '@/lib/tools/agents/evidenceStoreTool';
import {
  ensureSessionDirs,
  updateManifest,
  writeArtifact,
  writeManifest,
  readManifest,
  sessionDir,
  sanitizeFilename,
} from '@/lib/utils/deepResearchFS';
import { getModelName } from '@/lib/utils/modelUtils';
import fs from 'fs';
import path from 'path';
import type { SessionManifest } from '@/lib/state/deepResearchAgentState';
import computeSimilarity from '@/lib/utils/computeSimilarity';

/**
 * DeepResearchAgent — phased orchestrator with budgets, cancellation, and progress streaming.
 * Tools and persistence are stubbed for now; real tool calls and FS writes land in later tasks.
 */
export class DeepResearchAgent {
  // Budgets: 15 minutes wall clock, 50 LLM turns (soft stop at ~85%)
  private static readonly WALL_CLOCK_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly LLM_TURNS_HARD_LIMIT = 50;
  private static readonly LLM_TURNS_SOFT_LIMIT = Math.floor(
    DeepResearchAgent.LLM_TURNS_HARD_LIMIT * 0.85,
  );

  private startTime = Date.now();
  private llmTurns = 0;
  private aborted = false;
  // Token usage tracking across phases (normalized across providers)
  private totalUsage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  private phaseUsage: Partial<
    Record<
      Phase,
      { input_tokens: number; output_tokens: number; total_tokens: number }
    >
  > = {};

  // Phase tracking
  private phases: Phase[] = [
    'Plan',
    'Search',
    'ReadExtract',
    'ClusterMap',
    'Synthesize',
    'Review',
  ];
  private currentPhaseIndex = 0;
  private earlySynthesisTriggered = false;

  // Minimal internal state to support phase-to-phase handoff (will be replaced by dedicated state model later)
  private state: {
    plan?: { subquestions: string[]; notes?: string[] };
    // Legacy combined fields are now derived from perSubquery results
    candidates?: Array<{ title: string; url: string }>;
    extracted?: Array<{
      url: string;
      facts: string[];
      quotes: string[];
      title?: string;
    }>;
    evidence?: EvidenceItem[];
    clusters?: Array<{
      label: string;
      docUrls: string[];
      summary?: string;
      noveltyScore?: number;
      subquestionScores?: Record<string, number>;
    }>;
    outline?: { sections: Array<{ title: string; bullets: string[] }> };
    perSubquery?: Array<SubqueryResult>;
  } = {};
  private query: string = '';

  constructor(
    private llm: BaseChatModel,
    private embeddings: Embeddings,
    private emitter: EventEmitter,
    private systemInstructions: string,
    private personaInstructions: string,
    private signal: AbortSignal,
    private chatId: string,
  ) {
    // Observe cancellation
    this.signal.addEventListener('abort', () => {
      this.aborted = true;
    });
  }

  async searchAndAnswer(
    query: string,
    history: any[] = [],
    fileIds: string[] = [],
  ): Promise<void> {
    try {
      this.query = query;
      this.emitResponse(`[Deep Research] initializing...\n`);
      this.emitResponse(`Query: ${query}\n`);
      if (this.chatId) {
        ensureSessionDirs(this.chatId);
        const manifest: SessionManifest = {
          chatId: this.chatId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'running',
          budgets: {
            wallClockMs: DeepResearchAgent.WALL_CLOCK_LIMIT_MS,
            llmTurnsHard: DeepResearchAgent.LLM_TURNS_HARD_LIMIT,
            llmTurnsSoft: DeepResearchAgent.LLM_TURNS_SOFT_LIMIT,
          },
          tokensByPhase: {},
          llmTurnsUsed: 0,
          counts: {},
          phases: {},
        };
        writeManifest(this.chatId, manifest);
      }

      // Phase: Plan
      await this.runPhase('Plan', async () => {
        await this.planPhase(query, history);
      });

      // Phase: Search
      if (!this.shouldJumpToSynthesis()) {
        await this.runPhase('Search', async () => {
          await this.searchPhase();
        });
      }

      // Phase: Read/Extract
      if (!this.shouldJumpToSynthesis()) {
        await this.runPhase('ReadExtract', async () => {
          await this.readExtractPhase();
        });
      }

      // Phase: Cluster/Map
      // if (!this.shouldJumpToSynthesis()) {
      //   await this.runPhase('ClusterMap', async () => {
      //     await this.clusterMapPhase();
      //   });
      // }

      // Phase: Synthesize (always reached; may be early)
      await this.runPhase('Synthesize', async () => {
        await this.synthesizePhase(query);
      });

      // Phase: Review
      await this.runPhase('Review', async () => {
        await this.reviewPhase();
      });

      // Finalize
      // Emit basic model stats prior to finish
      const evCount = this.state.evidence?.length || 0;
      const avgNovelty =
        this.state.clusters && this.state.clusters.length
          ? this.state.clusters.reduce((a, c) => a + (c.noveltyScore || 0), 0) /
            this.state.clusters.length
          : 0.5;
      const confidence = Math.min(
        1,
        0.3 + 0.7 * Math.min(1, evCount / 50) * avgNovelty,
      );
      this.emitter.emit(
        'stats',
        JSON.stringify({
          type: 'modelStats',
          data: {
            modelName: getModelName(this.llm),
            confidence,
            usage: this.totalUsage,
            phaseUsage: Object.fromEntries(
              (Object.keys(this.phaseUsage) as Phase[]).map((p) => [
                p,
                this.phaseUsage[p]?.total_tokens ?? 0,
              ]),
            ),
          },
        }),
      );
      // Emit sources list for UI
      const sources = Array.from(
        new Map(
          (this.state.extracted || []).map((d: any) => [
            d.url,
            { title: d.title || d.url, url: d.url },
          ]),
        ).values(),
      );
      this.emitter.emit(
        'sources',
        JSON.stringify({ type: 'sources', data: sources }),
      );
      if (this.chatId)
        updateManifest(this.chatId, {
          status: 'completed',
          llmTurnsUsed: this.llmTurns,
        });
      this.emitResponse(`\n[Deep Research] complete.\n`);
      this.emitter.emit('end');
    } catch (err: any) {
      if (this.aborted || this.signal.aborted) {
        // Graceful finalize on cancel
        this.emitResponse(
          `\n[Deep Research] cancelled. Emitting best-effort summary.\n`,
        );
        if (this.chatId)
          updateManifest(this.chatId, {
            status: 'cancelled',
            llmTurnsUsed: this.llmTurns,
          });
        // We could attempt a brief synthesis here if not yet done.
        this.emitter.emit('end');
        return;
      }
      // Unexpected error
      if (this.chatId)
        updateManifest(this.chatId, {
          status: 'error',
          llmTurnsUsed: this.llmTurns,
        });
      this.emitter.emit('error', err);
    }
  }

  // --------------- Internal orchestration helpers ---------------

  private async runPhase(phase: Phase, fn: () => Promise<void>) {
    if (this.abortedOrTimedOut()) return;

    this.currentPhaseIndex = this.phases.indexOf(phase);
    const pct = this.phasePercent();
    this.emitProgress(phase, `Starting ${phase} phase`, pct);
    if (this.chatId)
      updateManifest(this.chatId, { phase, phaseEvent: 'start' });

    await fn();

    // After phase complete, report progress
    const afterPct = this.phasePercent(true);
    // 7.4 accuracy: only use real observed tokens per phase (no estimates)
    const phaseTok = this.phaseUsage[phase]?.total_tokens ?? 0;
    const totalTok = this.totalUsage.total_tokens;
    const subMsg = `Tokens this phase: ${Math.round(phaseTok)} • Total: ${Math.round(totalTok)}`;
    this.emitProgress(phase, `${phase} complete`, afterPct, subMsg);
    // Persist tokens for this phase (prefer real if available)
    this.persistTokensByPhase(phase);
    // Emit a model stats snapshot including usage
    this.emitter.emit(
      'stats',
      JSON.stringify({
        type: 'modelStats',
        data: {
          modelName: getModelName(this.llm),
          usage: this.totalUsage,
          phaseUsage: Object.fromEntries(
            (Object.keys(this.phaseUsage) as Phase[]).map((p) => [
              p,
              this.phaseUsage[p]?.total_tokens ?? 0,
            ]),
          ),
        },
      }),
    );
    if (this.chatId)
      updateManifest(this.chatId, {
        phase,
        phaseEvent: 'complete',
        llmTurnsUsed: this.llmTurns,
      });
  }

  private shouldJumpToSynthesis(): boolean {
    if (this.earlySynthesisTriggered) return true;
    // Soft limit: when reaching soft LLM turns threshold, move to Synthesis
    if (this.llmTurns >= DeepResearchAgent.LLM_TURNS_SOFT_LIMIT) {
      this.earlySynthesisTriggered = true;
      this.emitProgress(
        'Synthesize',
        'Soft budget reached — moving to synthesis early',
        this.phasePercent(),
      );
      return true;
    }
    return false;
  }

  private abortedOrTimedOut(): boolean {
    if (this.aborted || this.signal.aborted) return true;
    if (Date.now() - this.startTime > DeepResearchAgent.WALL_CLOCK_LIMIT_MS) {
      this.emitProgress(
        'Synthesize',
        'Wall-clock limit reached',
        this.phasePercent(),
      );
      this.earlySynthesisTriggered = true; // force moving on
      return true;
    }
    return false;
  }

  private elapsedMs(): number {
    return Date.now() - this.startTime;
  }

  private phasePercent(after = false): number {
    const total = this.phases.length;
    const idx = this.currentPhaseIndex + (after ? 1 : 0);
    return Math.round((idx / total) * 100);
  }

  private emitResponse(text: string) {
    this.emitter.emit('data', JSON.stringify({ type: 'response', data: text }));
  }

  // Normalize usage metadata fields from different providers
  private normalizeUsageMetadata(usageData: any): {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  } {
    if (!usageData)
      return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
    const inputTokens =
      usageData.input_tokens ||
      usageData.prompt_tokens ||
      usageData.promptTokens ||
      usageData.usedTokens ||
      0;
    const outputTokens =
      usageData.output_tokens ||
      usageData.completion_tokens ||
      usageData.completionTokens ||
      0;
    const totalTokens =
      usageData.total_tokens ||
      usageData.totalTokens ||
      usageData.usedTokens ||
      inputTokens + outputTokens;
    return {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
    };
  }

  private addPhaseUsage(phase: Phase, usageData: any) {
    const norm = this.normalizeUsageMetadata(usageData);
    // Update totals
    this.totalUsage.input_tokens += norm.input_tokens;
    this.totalUsage.output_tokens += norm.output_tokens;
    this.totalUsage.total_tokens += norm.total_tokens;
    // Update per-phase
    const prev = this.phaseUsage[phase] || {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    };
    this.phaseUsage[phase] = {
      input_tokens: prev.input_tokens + norm.input_tokens,
      output_tokens: prev.output_tokens + norm.output_tokens,
      total_tokens: prev.total_tokens + norm.total_tokens,
    };
  }

  private emitProgress(
    phase: Phase,
    message: string,
    percent: number,
    subMessage?: string,
  ) {
    // Emit progress with standard shape used by UI (message, current, total)
    const progressData: any = {
      message,
      current: percent,
      total: 100,
    };
    if (subMessage) progressData.subMessage = subMessage;

    this.emitter.emit(
      'progress',
      JSON.stringify({ type: 'progress', data: progressData }),
    );
  }

  private countLLMTurns(n = 1) {
    this.llmTurns += n;
    if (this.llmTurns >= DeepResearchAgent.LLM_TURNS_HARD_LIMIT) {
      this.emitProgress(
        'Synthesize',
        'Hard LLM-turn limit reached',
        this.phasePercent(),
      );
      this.earlySynthesisTriggered = true;
    }
  }

  // Placeholder for selecting a cheaper model for extraction/summarization in the future
  private getExtractorLLM(): BaseChatModel {
    return this.llm;
  }

  private persistTokensByPhase(phase: Phase) {
    if (!this.chatId) return;
    const manifest = readManifest(this.chatId);
    if (!manifest) return;
    // 7.4: persist only real observed tokens for this phase; if none observed, store 0
    const real = this.phaseUsage[phase]?.total_tokens;
    const tokens = typeof real === 'number' ? real : 0;
    writeManifest(this.chatId, {
      ...manifest,
      tokensByPhase: { ...(manifest.tokensByPhase || {}), [phase]: tokens },
      updatedAt: new Date().toISOString(),
    } as SessionManifest);
  }

  // --------------- Phase stubs (tools/persistence land later) ---------------

  private async planPhase(query: string, history: any[]) {
    this.ensureNotAborted();
    // TODO: Replace with deepPlannerTool invoking planner prompt (M3)
    this.countLLMTurns();
    this.state.plan = await deepPlannerTool(
      this.llm,
      query,
      history as any,
      this.systemInstructions,
      (usage) => this.addPhaseUsage('Plan', usage),
    );
    this.emitProgress(
      'Plan',
      'Generated research subquestions',
      this.phasePercent(true),
      `${this.state.plan.subquestions.length} subquestions`,
    );
    if (this.chatId) {
      writeArtifact(this.chatId, 'plan', 'plan', this.state.plan);
      // Persist plan counts into manifest
      updateManifest(this.chatId, {
        counts: { candidates: 0 },
      });
    }
  }

  private async searchPhase() {
    this.ensureNotAborted();
    const subqs = this.state.plan?.subquestions || [];
    if (!subqs.length) return;

    // Treat each subquestion as its own gather/rerank flow.
    const perSub: SubqueryResult[] = [];
    let totalCandidates = 0;
    for (let i = 0; i < subqs.length; i++) {
      if (this.abortedOrTimedOut()) break;
      const sq = subqs[i];
      // Gather candidates specific to this subquestion (broad pass)
      const reranked = await this.gatherCandidatesForSubq(sq, 'broad');
      perSub.push({
        subquestion: sq,
        candidates: reranked,
        extracted: [],
        evidence: [],
        sufficiency: 'pending',
      });
      totalCandidates += reranked.length;

      this.emitProgress(
        'Search',
        `Subquery ${i + 1}/${subqs.length}: gathered ${reranked.length} candidates`,
        this.phasePercent(),
      );
      if (this.chatId) {
        writeArtifact(
          this.chatId,
          'raw',
          `candidates_${sanitizeFilename(sq)}`,
          reranked,
        );
      }
    }

    this.state.perSubquery = perSub;
    // Maintain legacy flattened candidates for downstream compatibility/UX
    this.state.candidates = perSub.flatMap((p) => p.candidates);

    this.emitProgress(
      'Search',
      'Collected candidate sources (per-subquery)',
      this.phasePercent(true),
      `${totalCandidates} total across ${perSub.length} subqueries`,
    );
    if (this.chatId) {
      updateManifest(this.chatId, {
        counts: { candidates: totalCandidates },
      });
    }
  }

  private async readExtractPhase() {
    this.ensureNotAborted();
    // Simulate multiple small turns for extraction across documents
    this.countLLMTurns(3);
    const perSub = this.state.perSubquery || [];
    let globalExtracted: ExtractedDoc[] = [];
    let globalEvidence: EvidenceItem[] = [];
    let totalFacts = 0;

    for (let i = 0; i < perSub.length; i++) {
      if (this.abortedOrTimedOut()) break;
      const sub = perSub[i];

      // Reuse cached extracted docs for this subquery's candidates
      const cachedExtracted: ExtractedDoc[] = [];
      if (this.chatId && (sub.candidates?.length || 0) > 0) {
        const base = sessionDir(this.chatId);
        const dir = path.join(base, 'extracted');
        if (fs.existsSync(dir)) {
          for (const c of sub.candidates) {
            try {
              const file = path.join(dir, `${sanitizeFilename(c.url)}.json`);
              if (fs.existsSync(file)) {
                const data = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (data?.url) cachedExtracted.push(data);
              }
            } catch {}
          }
        }
      }

      const extracted = await readerExtractorTool(
        sub.candidates || [],
        // Use the subquestion as the extraction query for tighter relevance
        sub.subquestion,
        this.getExtractorLLM(),
        this.signal,
        (usage) => this.addPhaseUsage('ReadExtract', usage),
      );
      const evidence = evidenceStoreTool(extracted);
      const rankedEvidence = await this.rankEvidenceForSubq(
        sub.subquestion,
        evidence,
      );

      // Assess sufficiency; possibly run a depth pass (single retry) if needed
      let sufficiency = this.assessSubquerySufficiency(
        sub.subquestion,
        rankedEvidence,
      );
      if (sufficiency.status === 'needsDepth') {
        // Depth pass with more authoritative sources
        const depthCandidates = await this.gatherCandidatesForSubq(
          sub.subquestion,
          'depth',
        );
        // Add only new URLs
        const existingUrls = new Set(extracted.map((d) => d.url));
        const newDepthCandidates = depthCandidates.filter(
          (c) => !existingUrls.has(c.url),
        );
        if (newDepthCandidates.length) {
          const extractedDepth = await readerExtractorTool(
            newDepthCandidates,
            sub.subquestion,
            this.getExtractorLLM(),
            this.signal,
            (usage) => this.addPhaseUsage('ReadExtract', usage),
          );
          extracted.push(...extractedDepth);
          const evidenceDepth = evidenceStoreTool(extracted);
          const rankedDepth = await this.rankEvidenceForSubq(
            sub.subquestion,
            evidenceDepth,
          );
          sufficiency = this.assessSubquerySufficiency(
            sub.subquestion,
            rankedDepth,
          );
          // Persist artifacts for depth pass
          if (this.chatId) {
            for (const doc of extractedDepth) {
              writeArtifact(this.chatId, 'extracted', doc.url, doc);
            }
            writeArtifact(
              this.chatId,
              'raw',
              `candidates_depth_${sanitizeFilename(sub.subquestion)}`,
              depthCandidates,
            );
          }
          // Update ranked evidence reference
          rankedEvidence.splice(0, rankedEvidence.length, ...rankedDepth);
        }
      }

      perSub[i] = {
        ...sub,
        extracted,
        evidence: rankedEvidence,
        sufficiency: sufficiency.status,
      };
      globalExtracted = globalExtracted.concat(extracted);
      globalEvidence = globalEvidence.concat(rankedEvidence);
      totalFacts += extracted.reduce((acc, d) => acc + d.facts.length, 0);

      this.emitProgress(
        'ReadExtract',
        `Subquery ${i + 1}/${perSub.length}: extracted from ${extracted.length} docs`,
        this.phasePercent(),
      );
      if (this.chatId) {
        // Persist individual docs and per-subquery snapshot
        for (const doc of extracted) {
          writeArtifact(this.chatId, 'extracted', doc.url, doc);
        }
        writeArtifact(
          this.chatId,
          'extracted',
          `per_subq_${sanitizeFilename(sub.subquestion)}`,
          { extracted, evidence: rankedEvidence },
        );
      }
    }

    // Save back combined state for downstream phases and UI
    this.state.perSubquery = perSub;
    this.state.extracted = globalExtracted;
    this.state.evidence = globalEvidence;

    this.emitProgress(
      'ReadExtract',
      'Extracted concise facts and quotes (per-subquery)',
      this.phasePercent(true),
      `${totalFacts} facts from ${globalExtracted.length} docs`,
    );

    // Global re-evaluation: if most subqueries satisfied, trigger early synthesis
    const satisfied = (this.state.perSubquery || []).filter(
      (p) => p.sufficiency === 'sufficient',
    ).length;
    const totalSubq = this.state.perSubquery?.length || 0;
    if (totalSubq > 0) {
      const coverage = satisfied / totalSubq;
      if (coverage >= 0.6 && (this.state.evidence?.length || 0) >= 20) {
        this.emitProgress(
          'Synthesize',
          'Enough coverage across subquestions — moving to synthesis',
          this.phasePercent(),
        );
        this.earlySynthesisTriggered = true;
      }
    }
    if (this.chatId) {
      updateManifest(this.chatId, {
        counts: {
          extractedDocs: globalExtracted.length,
          facts: totalFacts,
          evidenceItems: globalEvidence.length,
        },
      });
    }
  }

  private async clusterMapPhase() {
    this.ensureNotAborted();
    // TODO: clusterCompressTool (embeddings + clustering) (M3)
    this.countLLMTurns();
    // Try cached clusters first
    let cachedClusters: any[] = [];
    if (this.chatId) {
      try {
        const file = path.join(
          sessionDir(this.chatId),
          'clusters',
          `${sanitizeFilename('clusters')}.json`,
        );
        if (fs.existsSync(file)) {
          cachedClusters = JSON.parse(fs.readFileSync(file, 'utf8'));
        }
      } catch {}
    }
    this.state.clusters = cachedClusters.length
      ? cachedClusters
      : await clusterCompressTool(
          this.state.extracted || [],
          this.embeddings,
          { targetClusters: 3 },
          this.state.plan?.subquestions || [],
        );
    this.emitProgress(
      'ClusterMap',
      'Grouped evidence into topics',
      this.phasePercent(true),
      `${this.state.clusters.length} clusters`,
    );
    if (this.chatId) {
      writeArtifact(this.chatId, 'clusters', 'clusters', this.state.clusters);
      updateManifest(this.chatId, {
        counts: { clusters: this.state.clusters.length },
      });
    }
  }

  private async synthesizePhase(query: string) {
    this.ensureNotAborted();
    // TODO: deepSynthesizerTool (outline + drafting) (M3)
    this.countLLMTurns(2);
    this.state.outline = await deepSynthesizerTool(
      query,
      this.state.plan?.subquestions || [],
      this.state.clusters || [],
      this.state.evidence || [],
    );
    this.emitProgress(
      'Synthesize',
      'Drafted outline and sections',
      this.phasePercent(true),
      `${this.state.outline.sections.length} sections`,
    );

    // Stream a cohesive answer with inline citations and headings
    this.emitResponse(`\n# ${query}\n`);
    for (const section of this.state.outline.sections) {
      this.emitResponse(`\n## ${section.title}\n`);
      for (const b of section.bullets) {
        this.emitResponse(`- ${b}\n`);
      }
      const conf = (this.state as any).outline?.confidenceBySection?.[
        section.title
      ];
      if (typeof conf === 'number') {
        this.emitResponse(`\nConfidence: ${(conf * 100).toFixed(0)}%\n`);
      }
    }

    // Consolidated sources section
    const sources = Array.from(
      new Map(
        (this.state.extracted || []).map((d: any) => [
          d.url,
          { title: d.title || d.url, url: d.url },
        ]),
      ).values(),
    );
    if (sources.length) {
      this.emitResponse(`\n## Sources\n`);
      for (const s of sources) {
        this.emitResponse(`- ${s.title} — ${s.url}\n`);
      }
    }
    if (this.chatId) {
      writeArtifact(this.chatId, 'outline', 'outline', this.state.outline);
      // Persist draft sections and section-level confidence
      const confidenceBySection = (this.state.outline as any)
        .confidenceBySection;
      updateManifest(this.chatId, {
        draftSections: this.state.outline.sections,
        confidenceBySection,
      } as any);
    }
  }

  private async reviewPhase() {
    this.ensureNotAborted();
    // TODO: reviewer prompt pass for coverage/consistency (M3)
    this.countLLMTurns();
    // Keep review summary minimal to avoid mixing with progress; detailed output will be part of final synthesis in future steps
  }

  // Tool methods removed in favor of imports above

  private ensureNotAborted() {
    if (this.aborted || this.signal.aborted) {
      throw new Error('aborted');
    }
    if (Date.now() - this.startTime > DeepResearchAgent.WALL_CLOCK_LIMIT_MS) {
      // Treat timeout as soft trigger to move on; upper layers will finalize
      this.earlySynthesisTriggered = true;
    }
  }

  // --------------- Helpers for per-subquery flows ---------------

  private async rerankCandidatesForSubq(
    subquestion: string,
    candidates: Candidate[],
    maxOut: number = 12,
  ): Promise<Candidate[]> {
    if (!candidates.length) return [];
    try {
      const qv = await this.embeddings.embedQuery(subquestion);
      const texts = candidates.map((c) =>
        `${c.title || ''}\n${c.snippet || ''}`.slice(0, 1000),
      );
      const dvs = await this.embeddings.embedDocuments(texts);
      const scored = candidates.map((c, i) => ({
        c,
        score: computeSimilarity(dvs[i], qv),
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, maxOut).map((s) => s.c);
    } catch {
      return candidates.slice(0, maxOut);
    }
  }

  private async rankEvidenceForSubq(
    subquestion: string,
    items: EvidenceItem[],
  ): Promise<EvidenceItem[]> {
    if (!items.length) return [];
    try {
      const qv = await this.embeddings.embedQuery(subquestion);
      const texts = items.map((e) => e.claim.slice(0, 1000));
      const dvs = await this.embeddings.embedDocuments(texts);
      const rescored = items.map((e, i) => ({
        e,
        // Blend semantic similarity with support count (normalized)
        sim: computeSimilarity(dvs[i], qv),
      }));
      const maxSupport = Math.max(...items.map((e) => e.supportCount || 1), 1);
      rescored.sort((a, b) => {
        const as = 0.6 * (a.e.supportCount / maxSupport) + 0.4 * a.sim;
        const bs = 0.6 * (b.e.supportCount / maxSupport) + 0.4 * b.sim;
        return bs - as;
      });
      return rescored.map((r) => r.e);
    } catch {
      return items; // fallback to supportCount ordering from evidenceStoreTool
    }
  }

  private async gatherCandidatesForSubq(
    subquestion: string,
    mode: 'broad' | 'depth',
  ): Promise<Candidate[]> {
    try {
      const queries =
        mode === 'broad'
          ? [subquestion]
          : [
              `${subquestion} site:gov OR site:edu`,
              `${subquestion} filetype:pdf`,
              `${subquestion} methodology OR "how it works"`,
              `${subquestion} statistics OR data`,
            ];
      // Query expansion: feed as multiple subqueries to diversify sources
      const candidates = await expandedSearchTool(queries, {
        maxPerSubq: mode === 'broad' ? 8 : 6,
        maxTotal: mode === 'broad' ? 8 : 18,
        maxPerDomain: 3,
      });
      // Semantic reranking to the original subquestion intent
      return await this.rerankCandidatesForSubq(subquestion, candidates);
    } catch {
      return [];
    }
  }

  private assessSubquerySufficiency(
    subquestion: string,
    evidence: EvidenceItem[],
  ): { status: 'sufficient' | 'needsMore' | 'needsDepth'; reason: string } {
    // Heuristics
    const E = evidence.length;
    const supportMax = Math.max(...evidence.map((e) => e.supportCount || 1), 1);
    const allSources = evidence.flatMap((e) => e.sources || []);
    const domains = new Set(
      allSources
        .map((s) => {
          try {
            return new URL(s.url).hostname.replace(/^www\./, '');
          } catch {
            return '';
          }
        })
        .filter(Boolean),
    );
    const quotes = evidence.reduce((acc, e) => acc + (e.examples?.length || 0), 0);

    if (E >= 8 && domains.size >= 3 && supportMax >= 2) {
      return { status: 'sufficient', reason: 'ample evidence and diversity' };
    }
    if (E >= 4 && (domains.size < 2 || quotes < 2)) {
      return { status: 'needsDepth', reason: 'needs authoritative or primary sources' };
    }
    return { status: 'needsMore', reason: 'insufficient evidence volume' };
  }
}

type Phase =
  | 'Plan'
  | 'Search'
  | 'ReadExtract'
  | 'ClusterMap'
  | 'Synthesize'
  | 'Review';

export default DeepResearchAgent;

// Local types
type SubqueryResult = {
  subquestion: string;
  candidates: Candidate[];
  extracted: ExtractedDoc[];
  evidence: EvidenceItem[];
  sufficiency: 'pending' | 'sufficient' | 'needsMore' | 'needsDepth';
};
