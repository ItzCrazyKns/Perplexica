import type { SessionManifest } from '@/lib/state/deepResearchAgentState';
import { deepPlannerTool } from '@/lib/tools/agents/deepPlannerTool';
import { searchQueryTool } from '@/lib/tools/agents/searchQueryTool';
import {
  ensureSessionDirs,
  readManifest,
  updateManifest,
  writeArtifact,
  writeManifest,
} from '@/lib/utils/deepResearchFS';
import { getModelName } from '@/lib/utils/modelUtils';
import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { EventEmitter } from 'events';
import { getLangfuseCallbacks } from '../tracing/langfuse';
import { formatDateForLLM } from '../utils';
// import { RunnableConfig } from '@langchain/core/runnables';
import { synthesizerPrompt } from '@/lib/prompts/synthesizer';
import { formattingAndCitationsScholarly } from '@/lib/prompts/templates';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { searchSearxng } from '../searxng';
import {
  extractWebFactsAndQuotes,
  ExtractFactsOutput,
  extractContentFactsAndQuotes,
} from '../utils/extractWebFacts';
import { withStructuredOutput } from '@/lib/utils/structuredOutput';
import z from 'zod';
import { Subquery } from 'drizzle-orm';
import pLimit from 'p-limit';
import { isSoftStop } from '@/lib/utils/runControl';
import { Phase } from '@/lib/types/deepResearchPhase';
import { getWebContent } from '../utils/documents';
import computeSimilarity from '../utils/computeSimilarity';
import { CachedEmbeddings } from '../utils/cachedEmbeddings';
import { TokenTextSplitter } from '@langchain/textsplitters';

/**
 * DeepResearchAgent — phased orchestrator with budgets, cancellation, and progress streaming.
 * Tools and persistence are stubbed for now; real tool calls and FS writes land in later tasks.
 */
export class DeepResearchAgent {
  // Budgets: 15 minutes wall clock, 100 LLM turns (soft stop at ~85%)
  private static readonly WALL_CLOCK_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly LLM_TURNS_HARD_LIMIT = 100;
  private static readonly LLM_TURNS_SOFT_LIMIT = Math.floor(
    DeepResearchAgent.LLM_TURNS_HARD_LIMIT * 0.85,
  );

  private startTime = Date.now();
  private llmTurns = 0;
  private aborted = false;
  // Token usage tracking across phases (normalized across providers)
  // Separate usage tracking for chat vs system models
  private totalUsageChat = {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
  };
  private totalUsageSystem = {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
  };
  private phaseUsage: Partial<
    Record<
      Phase,
      { input_tokens: number; output_tokens: number; total_tokens: number }
    >
  > = {};

  // Phase tracking
  private phases: Phase[] = ['Plan', 'Search', 'Enhance', 'Analyze', 'Answer'];
  private currentPhaseIndex = 0;
  private earlySynthesisTriggered = false;

  // Minimal internal state to support phase-to-phase handoff (will be replaced by dedicated state model later)
  private state: {
    plan?: { subquestions: string[]; notes?: string[]; criteria?: string[] };
    // Legacy combined fields are now derived from perSubquery results
    candidates?: Array<{ title: string; url: string }>;
    extracted?: Array<{
      url: string;
      facts: string[];
      quotes: string[];
      title?: string;
    }>;
    perSubquery?: Array<SubqueryResult>;
  } = {};
  private query: string = '';
  // Track chat history and re-planning guidance between passes
  private chatHistory: BaseMessage[] | any[] = [];
  private replanGuidance: string | null = null;
  private planPass: number = 0;

  constructor(
    private llm: BaseChatModel,
    private systemLlm: BaseChatModel,
    private embeddings: CachedEmbeddings,
    private emitter: EventEmitter,
    private personaInstructions: string,
    private signal: AbortSignal,
    private chatId: string,
    private messageId?: string,
    private retrievalSignal?: AbortSignal,
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
      this.chatHistory = history as any;
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

      // Write this on a background thread after a delay otherwise the emitter won't be listening
      setTimeout(() => {
        this.emitResponse(''); // Empty response, to give the UI a message to display.
      }, 100);

      try {
        do {
          // Phase: Plan
          await this.runPhase('Plan', async () => {
            await this.planPhase(query, history);
          });

          // Phase: Search
          if (!this.shouldJumpToSynthesis()) {
            await this.runPhase('Search', async () => {
              await this.searchPhase(history);
            });
          }

          // Phase: Enhance
          if (!this.shouldJumpToSynthesis()) {
            await this.runPhase('Enhance', async () => {
              await this.enhancePhase();
            });
          }
        } while (await this.needsMoreInfo());
      } catch (e: any) {
        if (this.retrievalSignal?.aborted) {
          console.log(
            'DeepResearchAgent: cancelled during Plan/Search. Emitting best-effort summary.',
          );
        } else {
          throw e;
        }
      }

      // Phase: Synthesize (always reached; may be early)
      await this.runPhase('Answer', async () => {
        await this.synthesizePhase(query);
      });

      // Finalize
      this.emitter.emit(
        'stats',
        JSON.stringify({
          type: 'modelStats',
          data: {
            modelName: getModelName(this.llm), // legacy
            modelNameChat: getModelName(this.llm),
            modelNameSystem: getModelName(this.systemLlm),
            usage: {
              input_tokens:
                this.totalUsageChat.input_tokens +
                this.totalUsageSystem.input_tokens,
              output_tokens:
                this.totalUsageChat.output_tokens +
                this.totalUsageSystem.output_tokens,
              total_tokens:
                this.totalUsageChat.total_tokens +
                this.totalUsageSystem.total_tokens,
            },
            usageChat: this.totalUsageChat,
            usageSystem: this.totalUsageSystem,
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
    const totalTok =
      this.totalUsageChat.total_tokens + this.totalUsageSystem.total_tokens;
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
          modelName: getModelName(this.llm), // legacy
          modelNameChat: getModelName(this.llm),
          modelNameSystem: getModelName(this.systemLlm),
          usage: {
            input_tokens:
              this.totalUsageChat.input_tokens +
              this.totalUsageSystem.input_tokens,
            output_tokens:
              this.totalUsageChat.output_tokens +
              this.totalUsageSystem.output_tokens,
            total_tokens:
              this.totalUsageChat.total_tokens +
              this.totalUsageSystem.total_tokens,
          },
          usageChat: this.totalUsageChat,
          usageSystem: this.totalUsageSystem,
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
    // Respond-now override
    if (this.messageId && isSoftStop(this.messageId)) {
      this.emitProgress(
        'Answer',
        'Respond-now triggered — moving to answer',
        this.phasePercent(),
      );
      this.earlySynthesisTriggered = true;
      return true;
    }
    // Soft limit: when reaching soft LLM turns threshold, move to Synthesis
    if (this.llmTurns >= DeepResearchAgent.LLM_TURNS_SOFT_LIMIT) {
      this.earlySynthesisTriggered = true;
      this.emitProgress(
        'Answer',
        'Soft budget reached — moving to answer early',
        this.phasePercent(),
      );
      return true;
    }
    return false;
  }

  private abortedOrTimedOut(): boolean {
    if (this.aborted || this.signal.aborted) return true;
    if (this.messageId && isSoftStop(this.messageId)) {
      this.earlySynthesisTriggered = true;
      return false; // don't abort; allow flow to continue to synthesis
    }
    if (Date.now() - this.startTime > DeepResearchAgent.WALL_CLOCK_LIMIT_MS) {
      this.emitProgress(
        'Answer',
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

  private phaseSubPercent(
    subIndex: number,
    totalSubs: number,
    after = false,
  ): number {
    const basePercent = this.phasePercent(false);
    const nextPhasePercent = this.phasePercent(true);
    const phaseRange = nextPhasePercent - basePercent;
    const subProgress = (subIndex + (after ? 1 : 0)) / totalSubs;
    return Math.round(basePercent + subProgress * phaseRange);
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

  private addPhaseUsage(
    phase: Phase,
    usageData: any,
    which: 'chat' | 'system' = 'system',
  ) {
    const norm = this.normalizeUsageMetadata(usageData);
    // Update totals separately for chat vs system
    if (which === 'chat') {
      this.totalUsageChat.input_tokens += norm.input_tokens;
      this.totalUsageChat.output_tokens += norm.output_tokens;
      this.totalUsageChat.total_tokens += norm.total_tokens;
    } else {
      this.totalUsageSystem.input_tokens += norm.input_tokens;
      this.totalUsageSystem.output_tokens += norm.output_tokens;
      this.totalUsageSystem.total_tokens += norm.total_tokens;
    }
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
          modelName: getModelName(this.llm), // legacy
          modelNameChat: getModelName(this.llm),
          modelNameSystem: getModelName(this.systemLlm),
          usage: {
            input_tokens:
              this.totalUsageChat.input_tokens +
              this.totalUsageSystem.input_tokens,
            output_tokens:
              this.totalUsageChat.output_tokens +
              this.totalUsageSystem.output_tokens,
            total_tokens:
              this.totalUsageChat.total_tokens +
              this.totalUsageSystem.total_tokens,
          },
          usageChat: this.totalUsageChat,
          usageSystem: this.totalUsageSystem,
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
        'Answer',
        'Hard LLM-turn limit reached',
        this.phasePercent(),
      );
      this.earlySynthesisTriggered = true;
    }
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

  private async planPhase(query: string, history: any[]) {
    this.ensureNotAborted();
    if (this.shouldJumpToSynthesis()) return;

    // First, use System LLM to craft an optimized search query using structured output tool
    this.emitProgress('Plan', 'Generating search query', this.phasePercent());
    let optimizedQuery = query;
    try {
      const res = await searchQueryTool(
        this.systemLlm,
        query,
        this.signal,
        history as any,
        (usage) => this.addPhaseUsage('Plan', usage, 'system'),
      );
      const candidate = (res?.searchQuery || '').trim();
      if (candidate && candidate.toLowerCase() !== 'not_needed') {
        optimizedQuery = candidate;
      }
      this.countLLMTurns();
    } catch (e) {
      console.warn(
        'Plan-phase query generation failed, falling back to raw query:',
        e,
      );
    }

    // One quick initial web scan to ground planning in current context
    this.emitProgress('Plan', 'Scanning web for context', this.phasePercent());
    let webContext = '';
    try {
      const searx = await searchSearxng(
        optimizedQuery,
        { language: 'en' },
        this.retrievalSignal,
      );
      const top = searx.results
        .filter(
          (r) =>
            r.title &&
            r.url &&
            !r.url.endsWith('.pdf') &&
            r.content &&
            r.content.length > 0,
        )
        .slice(0, 10);
      webContext = top
        .map((r, i) => {
          const title = r.title || `Result ${i + 1}`;
          // const url = r.url || '';
          const snippet = (r.content || '').replace(/\s+/g, ' ').slice(0, 220);
          return `Title: ${title}\nSnippet: ${snippet}\n`;
        })
        .join('\n');
    } catch (e) {
      // Non-fatal: proceed without web context
      console.warn('Plan-phase web scan failed:', e);
    }

    // Build planner guidance from previous pass if available
    const guidanceAppendix = this.replanGuidance
      ? `\n\nPlanner guidance (pass ${this.planPass + 1}):\n${this.replanGuidance}`
      : '';

    // Invoke planner with optional current web context
    this.countLLMTurns();
    this.state.plan = await deepPlannerTool(
      this.systemLlm,
      query,
      guidanceAppendix,
      this.signal,
      history as any,
      (usage) => this.addPhaseUsage('Plan', usage, 'system'),
      { webContext, date: formatDateForLLM(new Date()) },
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
    this.planPass += 1;
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
        this.phaseSubPercent(i, subqs.length),
      );

      const subqueryResult = await searchSearxng(
        sq,
        undefined,
        this.retrievalSignal,
      );

      this.emitProgress(
        'Search',
        `Extracting candidates for "${sq}" (${i + 1}/${subqs.length})`,
        this.phaseSubPercent(i, subqs.length),
      );

      const limit = pLimit(2);
      let extractCount = 0;
      const candidates = await limit.map(
        subqueryResult.results.filter(
          (r) =>
            r.title &&
            r.url &&
            !r.url.endsWith('.pdf') &&
            r.content &&
            r.content.length > 0,
        ),
        async (result) => {
          const empty = {
            url: result.url,
            title: result.title,
            rankedCandidates: [],
            facts: { facts: [], quotes: [], longContent: [] },
          };

          if (extractCount >= 5) {
            return empty;
          }
          if (this.abortedOrTimedOut()) return empty;
          // For each result, get the top ranked text segments by similarity to the query and subquery.
          // We are NOT YET filling out the facts/quotes structure. That will only happen if necessary.
          let rankedCandidates: string[] = [];
          try {
            const queryVector = await this.embeddings.embedQuery(sq);
            const webContent = await getWebContent(
              result.url,
              100000,
              false,
              this.retrievalSignal,
              true,
            );

            if (
              !webContent?.pageContent ||
              webContent.pageContent.length === 0
            ) {
              console.warn(
                `Search phase - no content extracted from ${result.url}`,
              );
              return empty;
            }

            extractCount++;

            const splitter = new TokenTextSplitter({
              chunkSize: 300,
              chunkOverlap: 50,
            });
            const chunks = await splitter.splitText(
              webContent?.pageContent || '',
            );

            // If the content is small enough, use all of it as a single candidate.
            // This is best since it preserves context and avoids chunking issues.
            // Otherwise, chunk the content and rank the chunks by similarity to the subquery.
            // 1200 words is a mid-sized blog post or news article.
            if (chunks.length <= 4) {
              console.log(
                `Search phase - using full content for ${result.url} (${(
                  webContent?.pageContent?.length || 0
                ).toLocaleString()} chars)`,
              );
              rankedCandidates = [webContent?.pageContent || ''];
            } else {
              // Embed each chunk and compute similarity
              const chunkVectors = await Promise.all(
                chunks.map(async (c) => await this.embeddings.embedQuery(c)),
              );
              const similarities = chunkVectors.map((vec) =>
                computeSimilarity(vec, queryVector),
              );
              // Rank chunks by similarity and take top 5
              const ranked = chunks
                .map((chunk, idx) => ({ chunk, score: similarities[idx] }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map((c) => c.chunk);
              rankedCandidates = ranked;
            }
          } catch (e) {
            console.warn('Subquery candidate extraction failed:', e);
          }

          // Extract facts and quotes from the top-ranked candidates
          // This is a potentially costly LLM operation so we do it only for the top few candidates
          const extracted = await extractContentFactsAndQuotes(
            rankedCandidates.join('\n\n'),
            sq,
            this.systemLlm,
            this.retrievalSignal || this.signal,
            (usage) => this.addPhaseUsage('Search', usage, 'system'),
          );

          return {
            url: result.url,
            title: result.title,
            rankedCandidates,
            facts: extracted || { facts: [], quotes: [], longContent: [] },
          };
        },
      );

      const candidateSources = candidates.filter(
        (c) =>
          c.facts.facts.length > 0 ||
          c.facts.quotes.length > 0 ||
          c.facts.longContent.length > 0,
      );

      // Emit sources as they're gathered during search phase
      if (candidateSources.length > 0) {
        const sources = candidateSources.map((c, idx) => ({
          metadata: {
            title: c.title || c.url || `Source ${idx + 1}`,
            url: c.url,
            processingType: 'url-content-extraction',
          },
        }));

        this.emitter.emit(
          'data',
          JSON.stringify({
            type: 'sources_added',
            data: sources,
            searchQuery: sq,
            searchUrl: '',
          }),
        );
      }

      perSub[i] = {
        subquestion: sq,
        extracted: candidateSources,
        sufficiency: 'pending',
      };

      console.log(
        `Search phase - subquery "${sq}" found ${candidateSources.length} candidate sources`,
        candidateSources,
      );

      totalCandidates += candidateSources.length;
      this.state.perSubquery = perSub;
      // Maintain legacy flattened candidates for downstream compatibility/UX
      this.state.candidates = perSub.flatMap((p) => p.extracted);
    }

    this.emitProgress(
      'Search',
      'Collected candidate sources (per-subquery)',
      this.phaseSubPercent(subqs.length - 1, subqs.length, true),
      `${totalCandidates} total across ${perSub.length} subqueries`,
    );
    if (this.chatId) {
      updateManifest(this.chatId, {
        counts: { candidates: totalCandidates },
      });
    }
  }

  private async enhancePhase() {
    this.ensureNotAborted();
    const perSub = this.state.perSubquery || [];

    // Filter to only subqueries with pending sufficiency
    const pendingSubqueries = perSub.filter(
      (sub) => sub.sufficiency === 'pending',
    );

    if (pendingSubqueries.length === 0) {
      this.emitProgress(
        'Enhance',
        'No subqueries need enhancement',
        this.phasePercent(true),
      );
      return;
    }

    this.emitProgress(
      'Enhance',
      `Enhancing ${pendingSubqueries.length} subqueries`,
      this.phasePercent(),
    );

    // Schema for structured LLM response to determine if subquery can be answered
    const SubquerySufficiencySchema = z.object({
      canAnswer: z
        .enum(['yes', 'no'])
        .describe(
          'Can the subquery be answered using the provided content in the context of the main user query?',
        ),
      reason: z
        .string()
        .optional()
        .nullable()
        .describe(
          'Brief explanation of why it can or cannot be answered (optional). Less than 30 words if provided.',
        ),
    });

    // Process each pending subquery
    for (let i = 0; i < pendingSubqueries.length; i++) {
      if (this.abortedOrTimedOut()) break;

      const subqueryResult = pendingSubqueries[i];
      const subquery = subqueryResult.subquestion;
      console.log(`Enhance phase - evaluating subquery: "${subquery}"`);

      this.emitProgress(
        'Enhance',
        `Evaluating "${subquery}" (${i + 1}/${pendingSubqueries.length})`,
        this.phaseSubPercent(i, pendingSubqueries.length),
      );

      // Prepare content from rankedCandidates
      const contentSummary = this.formattedCandidates(subqueryResult.extracted);

      if (!contentSummary || contentSummary.trim().length === 0) {
        // No content to evaluate, mark as needing enhancement
        this.emitProgress(
          'Enhance',
          `No content for "${subquery}" - extracting facts`,
          this.phaseSubPercent(i, pendingSubqueries.length),
        );
        await this.enhanceSubqueryWithFacts(subqueryResult);
        continue;
      }

      try {
        // Ask the system LLM if the subquery can be answered with current content
        const judge = withStructuredOutput(
          this.systemLlm,
          SubquerySufficiencySchema,
          {},
        );
        const messages = [
          new SystemMessage(
            [
              'You are evaluating whether a subquery can be adequately answered using the provided content.',
              'Consider the context of the main user query and whether the content provides sufficient information.',
              'Be conservative: if important details are missing or the content is too sparse, answer no.',
              'Respond with JSON containing "canAnswer" (yes/no) and optionally "reason".',
            ].join(' '),
          ),
          new HumanMessage(
            [
              `Main user query: ${this.query}`,
              `Subquery to evaluate: ${subquery}`,
              `Available content:\n${contentSummary}`,
            ].join('\n\n'),
          ),
        ];

        console.log(
          'Enhance phase - judging subquery with messages:',
          messages,
        );

        const result = await judge.invoke(messages, {
          signal: this.signal,
          callbacks: [
            {
              handleLLMEnd: async (output, _runId, _parentRunId) => {
                if (
                  output.llmOutput?.estimatedTokenUsage ||
                  output.llmOutput?.tokenUsage
                ) {
                  this.addPhaseUsage(
                    'Enhance',
                    output.llmOutput.estimatedTokenUsage ||
                      output.llmOutput.tokenUsage,
                    'system',
                  );
                }
              },
            },
          ],
        });
        this.countLLMTurns();

        console.log('Enhance phase - judging subquery result:', result);

        if (result?.canAnswer === 'yes') {
          // Mark subquery as sufficient
          subqueryResult.sufficiency = 'sufficient';
          this.emitProgress(
            'Enhance',
            `"${subquery}" marked as sufficient`,
            this.phaseSubPercent(i, pendingSubqueries.length),
          );
        } else {
          // Extract more facts and quotes for this subquery
          this.emitProgress(
            'Enhance',
            `Extracting facts for "${subquery}"`,
            this.phaseSubPercent(i, pendingSubqueries.length),
          );
          await this.enhanceSubqueryWithFacts(subqueryResult);
        }
      } catch (err) {
        console.warn(
          `Subquery evaluation failed for "${subquery}", extracting facts:`,
          err,
        );
        // On evaluation failure, err on the side of gathering more info
        await this.enhanceSubqueryWithFacts(subqueryResult);
      }
    }

    const enhancedCount = pendingSubqueries.filter(
      (sub) => sub.sufficiency === 'sufficient',
    ).length;

    this.emitProgress(
      'Enhance',
      'Enhancement complete',
      this.phasePercent(true),
      `${enhancedCount}/${pendingSubqueries.length} subqueries marked sufficient`,
    );
  }

  private async enhanceSubqueryWithFacts(subqueryResult: SubqueryResult) {
    const subquery = subqueryResult.subquestion;
    const limit = pLimit(2); // Limit concurrent extractions

    // Extract facts and quotes from each candidate source
    await Promise.all(
      subqueryResult.extracted.map((candidate) =>
        limit(async () => {
          if (this.abortedOrTimedOut()) return;

          try {
            const extracted = await extractWebFactsAndQuotes(
              candidate.url,
              subquery,
              this.systemLlm,
              this.retrievalSignal || this.signal,
              (usage) => this.addPhaseUsage('Enhance', usage, 'system'),
            );

            if (
              extracted &&
              (extracted.facts.length > 0 ||
                extracted.quotes.length > 0 ||
                extracted.longContent.length > 0)
            ) {
              // Merge the extracted facts with existing ones
              candidate.facts = {
                facts: [...(candidate.facts.facts || []), ...extracted.facts],
                quotes: [
                  ...(candidate.facts.quotes || []),
                  ...extracted.quotes,
                ],
                longContent: [
                  ...(candidate.facts.longContent || []),
                  ...extracted.longContent,
                ],
              };
            }
          } catch (err) {
            console.warn(`Fact extraction failed for ${candidate.url}:`, err);
          }
        }),
      ),
    );

    // Leave the subquery marked as 'pending' - it will be checked later by needsMoreInfo
  }

  private async needsMoreInfo(): Promise<boolean> {
    this.ensureNotAborted();
    if (this.shouldJumpToSynthesis()) return false;
    // Analyze coverage and decide if we have enough to move to synthesis.
    const perSub = this.state.perSubquery || [];

    // 1) Drop any subqueries with zero extracted sources (cleanup before assessment)
    const before = perSub.length;
    const filtered = perSub.filter(
      (p) =>
        (p.extracted?.length || 0) > 0 &&
        p.extracted.some(
          (e) =>
            (e.rankedCandidates?.length || 0) +
              (e.facts?.facts?.length || 0) +
              (e.facts?.quotes?.length || 0) +
              (e.facts?.longContent?.length || 0) >
            0,
        ),
    );

    if (filtered.length !== before) {
      this.emitProgress(
        'Analyze',
        `Removing ${before - filtered.length} subqueries with zero sources`,
        this.phasePercent(),
      );
    }

    this.state.perSubquery = filtered;
    this.state.candidates = filtered.flatMap((p) => p.extracted || []);

    // If nothing remains and we haven't hit early synthesis, request another pass
    if (this.state.perSubquery.length === 0 && !this.earlySynthesisTriggered) {
      this.replanGuidance = [
        'No usable sources were extracted in the last pass.',
        `Stay tightly focused on answering: "${this.query}".`,
        'Revise subquestions to target high-signal domains, official docs, data/methodology pages, and up-to-date coverage.',
        'Avoid tangents; prefer diverse phrasing and site/domain constraints if helpful.',
      ].join('\n- ');
      return true; // loop back to Plan
    }

    // 2) Ask the System LLM for a conservative yes/no sufficiency judgment
    this.emitProgress(
      'Analyze',
      'Evaluating whether evidence is sufficient',
      this.phasePercent(),
    );

    const plan = this.state.plan || {
      subquestions: [],
      notes: [],
      criteria: [],
    };

    // Summarize current coverage for the judge
    const coverageSummary = this.formattedCandidates(
      (this.state.perSubquery || []).flatMap((p) => p.extracted || []),
    );

    // Prepare a minimal structured output schema for yes/no
    const SufficiencySchema = z.object({
      sufficient: z
        .enum(['yes', 'no'])
        .describe(
          'Is the gathered evidence sufficient to write a high-quality, accurate answer with citations?',
        ),
      insufficient_reason: z
        .string()
        .optional()
        .nullable()
        .describe(
          'If "no", briefly explain why coverage is insufficient (optional)',
        ),
    });

    try {
      const judge = withStructuredOutput(this.systemLlm, SufficiencySchema, {});
      const messages = [
        new SystemMessage(
          [
            'You are a cautious research supervisor. Decide if there is enough high-quality, relevant evidence to answer the user question now.',
            'Consider the planning criteria and notes. Prefer recall and precision over verbosity. Be conservative: if major gaps remain, answer no.',
            "Respond with JSON containing only { 'sufficient': 'yes' | 'no' }.",
          ].join(' '),
        ),
        new HumanMessage(
          [
            `User question: ${this.query}`,
            plan.criteria && plan.criteria.length
              ? `Criteria: ${plan.criteria.join('; ')}`
              : 'Criteria: (none)',
            plan.notes && plan.notes.length
              ? `Notes: ${plan.notes.join('; ')}`
              : 'Notes: (none)',
            // this.chatHistory && Array.isArray(this.chatHistory) && this.chatHistory.length
            //   ? 'Chat history is available (not shown verbatim). Consider prior clarifications.'
            //   : 'No prior chat history provided.',
            'Current coverage summary:\n' +
              (coverageSummary || '(no coverage)'),
          ].join('\n\n'),
        ),
      ];

      const result = await judge.invoke(messages, {
        signal: this.signal,
        callbacks: [
          {
            handleLLMEnd: async (output, _runId, _parentRunId) => {
              if (
                output.llmOutput?.estimatedTokenUsage ||
                output.llmOutput?.tokenUsage
              ) {
                this.addPhaseUsage(
                  'Analyze',
                  output.llmOutput.estimatedTokenUsage ||
                    output.llmOutput.tokenUsage,
                  'system',
                );
              }
            },
          },
        ],
      });
      this.countLLMTurns();

      const isSufficient = result?.sufficient === 'yes';
      if (isSufficient) {
        this.emitProgress(
          'Analyze',
          'Sufficient coverage achieved — moving to Synthesis',
          this.phasePercent(true),
        );
        // Mark each subquery as sufficient
        (this.state.perSubquery || []).forEach(
          (p) => (p.sufficiency = 'sufficient'),
        );
        this.replanGuidance = null; // clear any prior guidance
        return false; // proceed to synthesis
      }

      // Not sufficient — craft guidance for the next planning pass
      const removedCount = before - filtered.length;
      const coveredTopics = filtered.map((p) => p.subquestion);
      const guidance: string[] = [];
      guidance.push(
        `Primary goal: answer "${this.query}" accurately with citations.`,
      );
      if (plan.criteria?.length) {
        guidance.push(`Honor these criteria: ${plan.criteria.join('; ')}`);
      }
      if (plan.notes?.length) {
        guidance.push(`Planner notes to respect: ${plan.notes.join('; ')}`);
      }
      if (removedCount > 0) {
        guidance.push(
          `${removedCount} prior subqueries produced zero usable sources. Replace or rephrase them; favor official docs, up-to-date analyses, and methodology/data pages.`,
        );
      }
      if (coveredTopics.length) {
        guidance.push(
          `Do not duplicate already-covered angles: ${coveredTopics.join('; ')}`,
        );
      }
      if (result?.insufficient_reason) {
        guidance.push(
          `Reason coverage is insufficient: ${result.insufficient_reason}`,
        );
      }
      guidance.push(
        'Propose refined, diverse subquestions that broaden high-signal coverage without drifting off-topic. Include different phrasings and, if useful, domain/site filters (e.g., gov/edu, vendor docs).',
      );

      this.replanGuidance = guidance.join('\n- ');
      console.log(
        'Sufficiency judge determined coverage is insufficient, replan guidance:',
        this.replanGuidance,
      );
      return true; // loop back to Plan
    } catch (err) {
      console.warn(
        'Sufficiency judge failed, defaulting to another pass:',
        err,
      );
      // On judge failure, err on the side of gathering more info unless budgets force synthesis
      if (this.shouldJumpToSynthesis()) return true;
      this.replanGuidance = [
        'The sufficiency check failed; generate a more robust plan focusing on authoritative and diverse sources.',
        `Stay focused on the user question: "${this.query}".`,
      ].join('\n- ');
      return true;
    }
  }

  private async synthesizePhase(query: string) {
    this.ensureNotAborted();

    // Build a lightweight "relevant documents" context from discovered candidates
    const perSub = this.state.perSubquery || [];
    const allCandidates: Array<Candidate> = perSub.flatMap(
      (p) => p.extracted || [],
    );
    const docsString = this.formattedCandidates(allCandidates);

    // Prepare the synthesizer prompt using the same style as simplifiedAgent
    const prompt = await ChatPromptTemplate.fromMessages([
      ['system', synthesizerPrompt],
      // The template itself contains the "Answer the user query" instruction
    ]).partial({
      recursionLimitReached: '',
      formattingAndCitations: this.personaInstructions
        ? this.personaInstructions
        : formattingAndCitationsScholarly.content,
      conversationHistory: '',
      exploredSubquestions: (this.state.plan?.subquestions || []).join('\n'),
      // Cap context to ~12,000 characters to keep within LLM input limits
      relevantDocuments: docsString || 'No context documents available.',
    });

    const chain = RunnableSequence.from([prompt, this.llm]).withConfig({
      runName: 'DeepSynthesis',
      ...getLangfuseCallbacks(),
      signal: this.signal,
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

    if (this.shouldJumpToSynthesis()) {
      this.emitResponse(
        `## ⚠︎ Early response triggered by budget or user request. ⚠︎\nResponse may be incomplete, lack citations, or omit important content.\n\n---\n\n`,
      );
    }

    for await (const event of eventStream) {
      if (this.signal.aborted || this.aborted) break;

      // Stream token-by-token like simplifiedAgent
      if (event.event === 'on_chat_model_stream' && event.data?.chunk) {
        const chunk = event.data.chunk;
        if (chunk.content && typeof chunk.content === 'string') {
          this.emitResponse(chunk.content);
        }
      }

      // Collect usage from various event shapes
      if (event.event === 'on_chat_model_end' && event.data?.output) {
        const output = event.data.output;
        const meta = output.usage_metadata || output.response_metadata?.usage;
        if (meta) {
          this.addPhaseUsage('Answer', meta, 'chat');
        }
      }

      if (
        event.event === 'on_llm_end' &&
        (event.data?.output?.llmOutput?.tokenUsage ||
          event.data?.output?.estimatedTokenUsage)
      ) {
        const t =
          event.data.output.llmOutput.tokenUsage ||
          event.data.output.estimatedTokenUsage;
        this.addPhaseUsage('Answer', t, 'chat');
      }
    }

    // Emit sources at the end of synthesis
    const sources = allCandidates.map((c, idx) => ({
      metadata: {
        title: c.title || c.url || `Source ${idx + 1}`,
        url: c.url,
        processingType: 'url-content-extraction',
        snippet:
          c.facts?.facts?.join(' ').slice(0, 200) ||
          c.facts?.quotes?.join(' ').slice(0, 200) ||
          '',
      },
    }));
    if (sources.length > 0) {
      this.emitter.emit(
        'data',
        JSON.stringify({
          type: 'sources',
          data: sources,
          searchQuery: '',
          searchUrl: '',
        }),
      );
    }
  }

  private formattedCandidates(allCandidates: Candidate[]): string {
    // Format into numbered XML-like blocks, similar to speedSearch.processDocs
    const docsString = allCandidates
      .map((c, idx) => {
        const title = c.title || c.url || `Source ${idx + 1}`;
        const url = c.url || '';
        return `<${idx + 1}>
<title>${title}</title>
${url ? `<url>${url}</url>` : ''}
<content>\n<facts>\n${c.facts?.facts.join('\n')}\n</facts><quotes>\n${c.facts?.quotes.join('\n')}\n</quotes><longContent>\n${c.facts?.longContent.join('\n')}\n</longContent>\n</content>
</${idx + 1}>`;
      })
      .join('\n\n');
    return docsString;
  }

  private ensureNotAborted() {
    if (this.aborted || this.signal.aborted) {
      throw new Error('aborted');
    }
    if (this.messageId && isSoftStop(this.messageId)) {
      // Flip early synthesis and return; callers will respect shouldJumpToSynthesis()
      this.earlySynthesisTriggered = true;
    }
    if (Date.now() - this.startTime > DeepResearchAgent.WALL_CLOCK_LIMIT_MS) {
      // Treat timeout as soft trigger to move on; upper layers will finalize
      this.earlySynthesisTriggered = true;
    }
  }
}

export default DeepResearchAgent;

// Local types
type SubqueryResult = {
  subquestion: string;
  extracted: Candidate[];
  sufficiency: 'pending' | 'sufficient' | 'needsMore' | 'needsDepth';
};

type Candidate = {
  url: string;
  title: string;
  rankedCandidates: string[];
  facts: ExtractFactsOutput;
};
