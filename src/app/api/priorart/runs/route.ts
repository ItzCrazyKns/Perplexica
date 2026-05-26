import fs from 'node:fs';
import path from 'node:path';
import configManager from '@/lib/config';

type RunFile = {
  name: string;
  path: string;
  size: number;
};

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
  reframe?: {
    pillars: number;
    nonPatentRefs: number;
    noiseDomains: number;
  };
  patentableEdges?: {
    total: number;
    strong: number;
    moderate: number;
    weak: number;
  };
};

export const GET = async () => {
  try {
    const pa = configManager.getCurrentConfig().priorart ?? {};
    const dataDir = process.env.DATA_DIR || process.cwd();
    const workspaceRoot = path.isAbsolute(pa.workspacePath)
      ? pa.workspacePath
      : path.join(dataDir, pa.workspacePath ?? 'data/priorart/workspaces');

    if (!fs.existsSync(workspaceRoot)) {
      return Response.json({ runs: [], workspaceRoot }, { status: 200 });
    }

    const runs: RunSummary[] = [];
    const featureDirs = fs.readdirSync(workspaceRoot).filter((d) => {
      const p = path.join(workspaceRoot, d);
      return fs.existsSync(p) && fs.statSync(p).isDirectory();
    });

    for (const featureId of featureDirs) {
      const featurePath = path.join(workspaceRoot, featureId);
      const timestamps = fs.readdirSync(featurePath).filter((t) => {
        const p = path.join(featurePath, t);
        return fs.existsSync(p) && fs.statSync(p).isDirectory();
      });

      for (const timestamp of timestamps) {
        const runDir = path.join(featurePath, timestamp);
        const entries = fs.readdirSync(runDir);
        const files: RunFile[] = entries.map((name) => {
          const p = path.join(runDir, name);
          const st = fs.statSync(p);
          return { name, path: p, size: st.size };
        });
        const run: RunSummary = {
          featureId,
          timestamp,
          workspaceDir: runDir,
          files,
        };
        const jsonFile = files.find((f) => f.name === 'memo.json');
        if (jsonFile) {
          try {
            const data = JSON.parse(fs.readFileSync(jsonFile.path, 'utf-8'));
            run.featureDescription = data?.memo?.featureDescription ?? data?.profile?.summary;
            run.referencesCount = data?.memo?.referencesOfInterest?.length ?? 0;
            run.openQuestionsCount = data?.memo?.openQuestionsForCounsel?.length ?? 0;
            const coverage: Array<{ novelty: string }> = data?.memo?.elementCoverage ?? [];
            if (coverage.length) {
              run.coverageCounts = {
                likely_novel: coverage.filter((c) => c.novelty === 'likely_novel').length,
                partial: coverage.filter((c) => c.novelty === 'partial').length,
                anticipated_risk: coverage.filter(
                  (c) => c.novelty === 'anticipated_risk',
                ).length,
              };
            }
            const pr = data?.memo?.primaryReference;
            if (pr) {
              run.primaryReference = {
                publicationNumber: pr.publicationNumber,
                elementCoverageFraction: pr.elementCoverageFraction,
              };
            }
            const warns: string[] = data?.memo?.verificationWarnings ?? [];
            run.domainFilterDropped = warns.filter((w) =>
              w.startsWith('Filtered '),
            ).length;
            const rf = data?.memo?.reframe;
            if (rf) {
              run.reframe = {
                pillars: rf.trueTechnicalPillars?.length ?? 0,
                nonPatentRefs: rf.nonPatentPriorArt?.length ?? 0,
                noiseDomains: rf.noiseDomainsToAvoid?.length ?? 0,
              };
            }
            const edges: Array<{ strength: string }> = data?.memo?.patentableEdges ?? [];
            if (edges.length) {
              run.patentableEdges = {
                total: edges.length,
                strong: edges.filter((e) => e.strength === 'strong').length,
                moderate: edges.filter((e) => e.strength === 'moderate').length,
                weak: edges.filter((e) => e.strength === 'weak').length,
              };
            }
          } catch {
            /* skip parse errors */
          }
        }
        runs.push(run);
      }
    }

    runs.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    return Response.json({ runs, workspaceRoot }, { status: 200 });
  } catch (err: any) {
    console.error(`[priorart/runs] ${err.message}`);
    return Response.json({ message: err.message }, { status: 500 });
  }
};
