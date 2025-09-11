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
import { SimplifiedAgent } from './simplifiedAgent';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { webSearchTools } from '../tools/agents';
import { buildWebSearchPrompt } from '../prompts/simplifiedAgent/webSearch';
import { formatDateForLLM } from '../utils';
import { SimplifiedAgentState } from '../state/chatAgentState';
import { getLangfuseCallbacks } from '../tracing/langfuse';
// import { RunnableConfig } from '@langchain/core/runnables';
import z from 'zod';
import { webSearchPrompt } from '../prompts/deepResearch/webSearch';
import { extractFactsAndQuotes } from '../utils/extractWebFacts';
import { searchSearxng } from '../searxng';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { synthesizerPrompt } from '@/lib/prompts/synthesizer';
import { formattingAndCitationsScholarly } from '@/lib/prompts/templates';

/**
 * DeepResearchAgent — phased orchestrator with budgets, cancellation, and progress streaming.
 * Tools and persistence are stubbed for now; real tool calls and FS writes land in later tasks.
 */
export class DeepResearchAgent {
  // Budgets: 25 minutes wall clock, 50 LLM turns (soft stop at ~85%)
  private static readonly WALL_CLOCK_LIMIT_MS = 25 * 60 * 1000; // 25 minutes
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

      do {
        // Phase: Plan
        await this.runPhase('Plan', async () => {
          await this.planPhase(query, history);
        });

        // TODO: Get search results then pass to another tool to get summaries and more details.

        // Phase: Search
        if (!this.shouldJumpToSynthesis()) {
          await this.runPhase('Search', async () => {
            await this.searchPhase(history);
          });
        }

        // Phase: Read/Extract
        if (!this.shouldJumpToSynthesis()) {
          await this.runPhase('ReadExtract', async () => {
            await this.readExtractPhase();
          });
        }
      } while (!this.needsMoreInfo());
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
          status: 'completed',
          llmTurnsUsed: this.llmTurns,
        });
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

  private async searchPhase(history: BaseMessage[]) {
    this.ensureNotAborted();
    const subqs = this.state.plan?.subquestions || [];
    if (!subqs.length) return;

    // Treat each subquestion as its own gather/rerank flow.
    const perSub: SubqueryResult[] = [];
    let totalCandidates = 0;
    for (let i = 0; i < subqs.length; i++) {
      if (this.abortedOrTimedOut()) break;
      const sq = subqs[i];

      this.emitProgress(
        'Search',
        `Searching ${sq} (${i + 1}/${subqs.length})`,
        this.phasePercent(),
      );

      const subqueryResult = await searchSearxng(sq);

      this.emitProgress(
        'Search',
        `Extracting candidates for "${sq}" (${i + 1}/${subqs.length})`,
        this.phasePercent(),
      );

      const facts = await Promise.all(
        subqueryResult.results.slice(0, 5).map(async (result) => {
          const extracted = await extractFactsAndQuotes(
            result.url,
            sq,
            this.llm,
            this.signal,
            (usage) => this.addPhaseUsage('Search', usage),
          );
          return {
            url: result.url,
            title: result.title,
            facts: extracted,
          };
        }),
      );

      const cleanedFacts = facts.filter((f) => (f?.facts?.facts?.length || 0) > 0 || (f?.facts?.quotes?.length || 0) > 0);

      console.log(cleanedFacts);

      perSub[i] = {
        subquestion: sq,
        candidates: cleanedFacts,
        evidence: [],
        sufficiency: 'sufficient',
        extracted: [],
      };

      // if (this.chatId) {
      //   writeArtifact(
      //     this.chatId,
      //     'raw',
      //     `candidates_${sanitizeFilename(sq)}`,
      //     reranked,
      //   );
      // }
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

  private async needsMoreInfo(): Promise<boolean> {
    this.ensureNotAborted();
    // Assess whether we need to re-enter search/extract based on evidence sufficiency
    if (!this.state.perSubquery) return false;
    let anyInsufficient = false;
    for (let i = 0; i < this.state.perSubquery.length; i++) {
      const subq = this.state.perSubquery[i];
      if (this.earlySynthesisTriggered && subq.candidates.length === 0) {
        // If early synthesis triggered and this subquery has no candidates, ignore it
        subq.sufficiency = 'sufficient';
        continue;
      }
      if (subq.sufficiency !== 'pending') continue; // already assessed
      const assessment = this.assessSubquerySufficiency(
        subq.subquestion,
        subq.evidence,
      );
      subq.sufficiency = assessment.status;
      if (assessment.status !== 'sufficient') {
        anyInsufficient = true;
      }
    }
    console.warn('TODO: needsMoreInfo: subquery sufficiency');
    return anyInsufficient;
  }

  private async synthesizePhase(query: string) {
    this.ensureNotAborted();
    // TODO: deepSynthesizerTool (outline + drafting) (M3)
    this.countLLMTurns(2);

    // Build a lightweight "relevant documents" context from discovered candidates
    const perSub = this.state.perSubquery || [];
    const allCandidates: Array<any> = perSub.flatMap((p) => p.candidates || []);

    // Format into numbered XML-like blocks, similar to speedSearch.processDocs
    const docsString = allCandidates
      .slice(0, 20)
      .map((c, idx) => {
        const title = c.title || c.name || c.url || `Source ${idx + 1}`;
        const url = c.url || '';
        return `<${idx + 1}>
<title>${title}</title>
${url ? `<url>${url}</url>` : ''}
<content>\n<facts>\n${c.facts?.facts.join('\n')}\n</facts><quotes>\n${c.facts?.quotes.join('\n')}\n</quotes>\n</content>
</${idx + 1}>`;
      })
      .join('\n\n');

    // Prepare the synthesizer prompt using the same style as simplifiedAgent
    const prompt = await ChatPromptTemplate.fromMessages([
      ['system', synthesizerPrompt],
      // The template itself contains the "Answer the user query" instruction
    ]).partial({
      recursionLimitReached: '',
      formattingAndCitations: this.personaInstructions
        ? this.personaInstructions
        : formattingAndCitationsScholarly,
      conversationHistory: '',
      relevantDocuments: docsString || 'No context documents available.',
    });

    const chain = RunnableSequence.from([prompt, this.llm]).withConfig({
      runName: 'DeepSynthesis',
      ...getLangfuseCallbacks(),
    });

    const config = {
      signal: this.signal,
      configurable: {
        thread_id: `deep_synthesis_${Date.now()}`,
        llm: this.llm,
        embeddings: this.embeddings,
        emitter: this.emitter,
      },
      ...getLangfuseCallbacks(),
    } as const;

    const eventStream = chain.streamEvents(
      { query },
      { ...config, version: 'v2' },
    );

    let usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

    for await (const event of eventStream) {
      if (this.signal.aborted || this.aborted) break;

      // Stream token-by-token like simplifiedAgent
      if (event.event === 'on_chat_model_stream' && event.data?.chunk) {
        const chunk = event.data.chunk;
        if (chunk.content && typeof chunk.content === 'string') {
          this.emitter.emit(
            'data',
            JSON.stringify({ type: 'response', data: chunk.content }),
          );
        }
      }

      // Collect usage from various event shapes
      if (event.event === 'on_chat_model_end' && event.data?.output) {
        const output = event.data.output;
        const meta = output.usage_metadata || output.response_metadata?.usage;
        if (meta) {
          this.addPhaseUsage('Synthesize', meta);
        }
      }

      if (
        event.event === 'on_llm_end' &&
        (event.data?.output?.llmOutput?.tokenUsage || event.data?.output?.estimatedTokenUsage)
      ) {
        const t = event.data.output.llmOutput.tokenUsage || event.data.output.estimatedTokenUsage;
        this.addPhaseUsage('Synthesize', t);
      }
    }

    // Emit sources at the end of synthesis
    const sources = allCandidates.map((c) => ({
      metadata: {
        title: c.title || c.name || c.url,
        url: c.url,
        processingType: 'url-content-extraction',
        snippet: c.facts?.facts?.join(' ').slice(0, 200) || c.facts?.quotes?.join(' ').slice(0, 200) || '',
      },
    }));
    if (sources.length > 0) {
      this.emitter.emit(
        'data',
        JSON.stringify({ type: 'sources', data: sources, searchQuery: '', searchUrl: '' }),
      );
    }
  }

  // --- Minimal stubs to satisfy phase flow until implemented ---
  private async readExtractPhase() {
    // In this v1 flow we already extract facts during search; skip.
    return;
  }

  private async reviewPhase() {
    // Placeholder for future critique/verification pass.
    return;
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
    const quotes = evidence.reduce(
      (acc, e) => acc + (e.examples?.length || 0),
      0,
    );

    if (E >= 8 && domains.size >= 3 && supportMax >= 2) {
      return { status: 'sufficient', reason: 'ample evidence and diversity' };
    }
    if (E >= 4 && (domains.size < 2 || quotes < 2)) {
      return {
        status: 'needsDepth',
        reason: 'needs authoritative or primary sources',
      };
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
