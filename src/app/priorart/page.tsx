'use client';

import {
  FileSearchIcon,
  FileTextIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  RefreshCcwIcon,
  ScaleIcon,
  ShieldAlertIcon,
  TableIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type RunResult = {
  workspaceId: string;
  workspaceDir: string;
  markdownPath: string;
  jsonPath: string;
  claimChartPath: string | null;
  warnings: string[];
  memo: any;
};

type RunFile = { name: string; path: string; size: number };

type RunSummary = {
  featureId: string;
  timestamp: string;
  workspaceDir: string;
  files: RunFile[];
  featureDescription?: string;
  referencesCount?: number;
  openQuestionsCount?: number;
  coverageCounts?: { likely_novel: number; partial: number; anticipated_risk: number };
  primaryReference?: { publicationNumber: string; elementCoverageFraction: number } | null;
  domainFilterDropped?: number;
  reframe?: { pillars: number; nonPatentRefs: number; noiseDomains: number };
  patentableEdges?: { total: number; strong: number; moderate: number; weak: number };
};

const RUN_PHASES = [
  'Parsing feature into technical elements (LLM, ~10-30s)',
  'Generating per-element search queries (LLM, ~10-30s)',
  'Searching USPTO ODP + Google Patents BigQuery in parallel',
  'Date guard + family dedupe + local embedding',
  'Landscape synthesis (LLM)',
  'Open-questions synthesis (LLM)',
  'Writing memo.md + memo.json to workspace',
];

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

const RunCard = ({ run }: { run: RunSummary }) => {
  const memo = run.files.find((f) => f.name === 'memo.md');
  const json = run.files.find((f) => f.name === 'memo.json');
  const chart = run.files.find((f) => f.name === 'claim_chart.md');
  return (
    <div className="rounded border border-border bg-background p-3 text-sm space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">{run.featureId}</div>
          <div className="text-xs text-muted-foreground">{run.timestamp.replaceAll('-', ':').replace(/:(\d\d)$/, '.$1')}</div>
        </div>
        <div className="text-xs text-muted-foreground text-right">
          {run.referencesCount !== undefined && (
            <div>{run.referencesCount} refs · {run.openQuestionsCount ?? 0} Qs</div>
          )}
        </div>
      </div>
      {run.featureDescription && (
        <div className="text-xs text-muted-foreground line-clamp-2">{run.featureDescription}</div>
      )}
      {run.coverageCounts && (
        <div className="flex flex-wrap gap-1 text-[10px] font-medium">
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400">
            ✓ {run.coverageCounts.likely_novel} novel
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
            ◐ {run.coverageCounts.partial} partial
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-700 dark:text-rose-400">
            ⚠ {run.coverageCounts.anticipated_risk} risk
          </span>
          {run.primaryReference && (
            <span
              className="inline-flex items-center gap-1 rounded bg-indigo-500/15 px-1.5 py-0.5 text-indigo-700 dark:text-indigo-400"
              title={`Primary reference to distinguish over: ${run.primaryReference.publicationNumber}`}
            >
              primary: {run.primaryReference.publicationNumber} (
              {(run.primaryReference.elementCoverageFraction * 100).toFixed(0)}%)
            </span>
          )}
          {!!run.domainFilterDropped && run.domainFilterDropped > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded bg-slate-500/15 px-1.5 py-0.5 text-slate-700 dark:text-slate-400"
              title="LLM-reasoned semantic filter dropped these as off-domain (e.g., batteries, machinery, substations matched by keyword)"
            >
              🪣 {run.domainFilterDropped} off-domain
            </span>
          )}
          {run.reframe && run.reframe.pillars > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-blue-700 dark:text-blue-400"
              title={`Deep Research reframe: ${run.reframe.pillars} pillars, ${run.reframe.nonPatentRefs} non-patent refs, ${run.reframe.noiseDomains} noise domains avoided`}
            >
              🧭 reframed ({run.reframe.pillars} pillars · {run.reframe.nonPatentRefs} arXiv/repo)
            </span>
          )}
          {run.patentableEdges && run.patentableEdges.total > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded bg-purple-500/15 px-1.5 py-0.5 text-purple-700 dark:text-purple-400"
              title={`Per-pillar patentable edges (claim-drafting prep): ${run.patentableEdges.strong} strong · ${run.patentableEdges.moderate} moderate · ${run.patentableEdges.weak} weak`}
            >
              ⚖️ {run.patentableEdges.total} edges ({run.patentableEdges.strong} strong)
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        {memo && (
          <a
            href={`/api/priorart/memo?path=${encodeURIComponent(memo.path)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20"
          >
            <FileTextIcon className="size-3" /> memo.md <span className="opacity-60">({formatBytes(memo.size)})</span>
          </a>
        )}
        {json && (
          <a
            href={`/api/priorart/memo?path=${encodeURIComponent(json.path)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted"
          >
            <TableIcon className="size-3" /> memo.json <span className="opacity-60">({formatBytes(json.size)})</span>
          </a>
        )}
        {chart && (
          <a
            href={`/api/priorart/memo?path=${encodeURIComponent(chart.path)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted"
          >
            <ScaleIcon className="size-3" /> claim_chart.md
          </a>
        )}
        <button
          onClick={() => {
            navigator.clipboard.writeText(run.workspaceDir);
            toast.success('Folder path copied to clipboard');
          }}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted"
          title={run.workspaceDir}
        >
          <FolderOpenIcon className="size-3" /> copy folder path
        </button>
      </div>
    </div>
  );
};

const ProgressIndicator = ({ phase, elapsed }: { phase: number; elapsed: number }) => (
  <div className="rounded border border-indigo-500/40 bg-indigo-500/5 p-4 space-y-2">
    <div className="flex items-center gap-2 font-medium">
      <LoaderCircleIcon className="size-4 animate-spin text-indigo-500" />
      Running — {elapsed}s elapsed (typical: 60-180s)
    </div>
    <ol className="text-xs space-y-1 ml-1">
      {RUN_PHASES.map((p, i) => (
        <li
          key={i}
          className={cn(
            'flex items-center gap-2',
            i < phase
              ? 'text-muted-foreground line-through opacity-60'
              : i === phase
                ? 'text-foreground font-medium'
                : 'text-muted-foreground/60',
          )}
        >
          <span className="inline-block w-4 text-center">
            {i < phase ? '✓' : i === phase ? '•' : '○'}
          </span>
          {p}
        </li>
      ))}
    </ol>
    <div className="text-xs text-muted-foreground italic pt-1">
      The page does not stream progress yet — phases are time-estimated. Output files appear in the
      Recent Runs panel above when the run finishes.
    </div>
  </div>
);

const Page = () => {
  const [featureDescription, setFeatureDescription] = useState('');
  const [claimText, setClaimText] = useState('');
  const [benchmarkDeltas, setBenchmarkDeltas] = useState('');
  const [priorityDate, setPriorityDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [memoMarkdown, setMemoMarkdown] = useState<string>('');
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [workspaceRoot, setWorkspaceRoot] = useState<string>('');

  const refreshRuns = useCallback(async () => {
    try {
      const resp = await fetch('/api/priorart/runs');
      if (!resp.ok) return;
      const data = (await resp.json()) as { runs: RunSummary[]; workspaceRoot: string };
      setRuns(data.runs);
      setWorkspaceRoot(data.workspaceRoot);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshRuns();
  }, [refreshRuns]);

  // estimated-phase ticker during a run
  useEffect(() => {
    if (!running) return;
    setElapsed(0);
    setPhase(0);
    const t0 = Date.now();
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      setElapsed(s);
      // rough time bands (calibrated to observed ~100s total)
      if (s < 20) setPhase(0);
      else if (s < 40) setPhase(1);
      else if (s < 60) setPhase(2);
      else if (s < 80) setPhase(3);
      else if (s < 100) setPhase(4);
      else if (s < 120) setPhase(5);
      else setPhase(6);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const run = async (mode: 'clear' | 'landscape') => {
    if (featureDescription.trim().length < 20) {
      toast.error('Feature description must be at least 20 characters.');
      return;
    }
    setRunning(true);
    setResult(null);
    setMemoMarkdown('');
    try {
      const endpoint = mode === 'landscape' ? '/api/priorart/landscape' : '/api/priorart/clear';
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureDescription,
          claimText: mode === 'clear' && claimText.trim() ? claimText : undefined,
          benchmarkDeltas: benchmarkDeltas.trim() ? benchmarkDeltas : undefined,
          priorityDate,
          mode,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        toast.error(err.message ?? `Request failed (${resp.status})`);
        return;
      }
      const data = (await resp.json()) as RunResult;
      setResult(data);
      const md = await fetch(`/api/priorart/memo?path=${encodeURIComponent(data.markdownPath)}`).catch(
        () => null,
      );
      if (md && md.ok) setMemoMarkdown(await md.text());
      await refreshRuns();
      toast.success('Run complete');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to run prior art mode.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col px-6 py-8 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <ScaleIcon className="size-6 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-semibold">Prior Art Mode</h1>
          <p className="text-sm text-muted-foreground">
            Research artifact, not legal opinion. Counsel review required.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Recent runs {runs.length > 0 && `(${runs.length})`}
          </h2>
          <button
            onClick={refreshRuns}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCcwIcon className="size-3" /> refresh
          </button>
        </div>
        {workspaceRoot && (
          <div className="text-xs text-muted-foreground">
            Workspace root: <code>{workspaceRoot}</code>
          </div>
        )}
        {runs.length === 0 ? (
          <div className="rounded border border-dashed border-border p-4 text-sm text-muted-foreground">
            No runs yet. Submit a feature description below to create the first one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {runs.slice(0, 12).map((r) => (
              <RunCard key={`${r.featureId}-${r.timestamp}`} run={r} />
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 border-t border-border pt-6">
        <label className="text-sm font-medium">
          Feature description (markdown / PRD excerpt)
          <textarea
            value={featureDescription}
            onChange={(e) => setFeatureDescription(e.target.value)}
            rows={10}
            placeholder="Paste a Switchyard feature description, PRD excerpt, or design doc."
            className={cn(
              'mt-1 w-full rounded border border-border bg-background p-3 text-sm font-mono',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500',
            )}
          />
        </label>

        <label className="text-sm font-medium">
          Draft claim (optional)
          <textarea
            value={claimText}
            onChange={(e) => setClaimText(e.target.value)}
            rows={4}
            placeholder="Paste a draft claim to enable claim-chart generation."
            className={cn(
              'mt-1 w-full rounded border border-border bg-background p-3 text-sm font-mono',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500',
            )}
          />
        </label>

        <label className="text-sm font-medium">
          A/B benchmark deltas (optional)
          <span className="block text-xs font-normal text-muted-foreground mt-0.5">
            Paste any head-to-head benchmark data showing how this product beats named alternatives. Feeds the patentable-edge distillation step as §103 evidence.
          </span>
          <textarea
            value={benchmarkDeltas}
            onChange={(e) => setBenchmarkDeltas(e.target.value)}
            rows={3}
            placeholder='e.g. "Beats OpenRouter cold-start by 4.2x in N=200 trial; beats vLLM on tail latency P99.999 by 8x; …"'
            className={cn(
              'mt-1 w-full rounded border border-border bg-background p-3 text-sm font-mono',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500',
            )}
          />
        </label>

        <label className="text-sm font-medium w-fit">
          Priority date
          <input
            type="date"
            value={priorityDate}
            onChange={(e) => setPriorityDate(e.target.value)}
            className="mt-1 block rounded border border-border bg-background p-2 text-sm"
          />
        </label>

        <div className="flex gap-3">
          <button
            disabled={running}
            onClick={() => run('clear')}
            className="inline-flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {running ? <LoaderCircleIcon className="size-4 animate-spin" /> : <FileSearchIcon className="size-4" />}
            Run clearance
          </button>
          <button
            disabled={running}
            onClick={() => run('landscape')}
            className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Landscape only
          </button>
        </div>
      </section>

      {running && <ProgressIndicator phase={phase} elapsed={elapsed} />}

      {result && (
        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-lg font-semibold">Run complete</h2>
          <div className="text-sm text-muted-foreground">
            Workspace: <code>{result.workspaceDir}</code>
          </div>
          {result.warnings.length > 0 && (
            <div className="rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-yellow-700 dark:text-yellow-400">
                <ShieldAlertIcon className="size-4" />
                Verification warnings
              </div>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {memoMarkdown && (
            <pre className="whitespace-pre-wrap rounded border border-border bg-muted/40 p-4 text-xs font-mono">
              {memoMarkdown}
            </pre>
          )}
        </section>
      )}
    </div>
  );
};

export default Page;
