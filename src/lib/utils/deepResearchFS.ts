import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SessionManifest } from '@/lib/state/deepResearchAgentState';
import { Phase } from '@/lib/types/deepResearchPhase';

const ROOT = path.resolve(
  process.cwd(),
  'storage',
  'deep_research',
  'sessions',
);

export function sessionDir(chatId: string) {
  return path.join(ROOT, chatId);
}

export function ensureSessionDirs(chatId: string) {
  const base = sessionDir(chatId);
  const dirs = [
    base,
    path.join(base, 'raw'),
    path.join(base, 'extracted'),
    path.join(base, 'clusters'),
    path.join(base, 'embeddings'),
  ];
  for (const d of dirs) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export function sanitizeFilename(input: string) {
  // Use a short hash for stability and to avoid path issues
  const hash = crypto
    .createHash('md5')
    .update(input)
    .digest('hex')
    .slice(0, 12);
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base ? `${base}-${hash}` : hash;
}

export function manifestPath(chatId: string) {
  return path.join(sessionDir(chatId), 'manifest.json');
}

export function writeManifest(chatId: string, manifest: SessionManifest) {
  ensureSessionDirs(chatId);
  fs.writeFileSync(
    manifestPath(chatId),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );
}

export function readManifest(chatId: string): SessionManifest | null {
  try {
    const p = manifestPath(chatId);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8')) as SessionManifest;
  } catch {
    return null;
  }
}

export function updateManifest(
  chatId: string,
  update: Partial<SessionManifest> & {
    phase?: Phase;
    phaseEvent?: 'start' | 'complete';
  },
) {
  const current =
    readManifest(chatId) ||
    ({
      chatId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'running',
      budgets: { wallClockMs: 0, llmTurnsHard: 0, llmTurnsSoft: 0 },
      tokensByPhase: {},
      llmTurnsUsed: 0,
      counts: {},
      phases: {},
    } as SessionManifest);

  const next: SessionManifest = {
    ...current,
    ...update,
    updatedAt: new Date().toISOString(),
  } as SessionManifest;

  if (update.phase && update.phaseEvent) {
    next.phases = next.phases || {};
    const p = next.phases[update.phase] || {};
    if (update.phaseEvent === 'start') p.startedAt = new Date().toISOString();
    if (update.phaseEvent === 'complete')
      p.completedAt = new Date().toISOString();
    next.phases[update.phase] = p;
  }

  writeManifest(chatId, next);
}

export type ArtifactType =
  | 'raw'
  | 'extracted'
  | 'clusters'
  | 'embeddings'
  | 'plan'
  | 'outline'
  | 'draft';

export function writeArtifact(
  chatId: string,
  type: ArtifactType,
  name: string,
  data: any,
) {
  ensureSessionDirs(chatId);
  const base = sessionDir(chatId);
  let subDir: string = type as string;
  if (type === 'plan' || type === 'outline' || type === 'draft') subDir = '';
  const dir = subDir ? path.join(base, subDir) : base;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sanitizeFilename(name)}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  return file;
}

export function deleteSessionArtifacts(chatId: string) {
  const base = sessionDir(chatId);
  if (!base.startsWith(ROOT)) {
    throw new Error('Unsafe delete path');
  }
  if (!fs.existsSync(base)) return;
  // Recursively remove
  fs.rmSync(base, { recursive: true, force: true });
}
