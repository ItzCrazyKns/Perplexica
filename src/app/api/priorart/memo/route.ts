import fs from 'node:fs';
import path from 'node:path';
import configManager from '@/lib/config';

export const GET = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const p = url.searchParams.get('path');
    if (!p) return new Response('path required', { status: 400 });

    const pa = configManager.getCurrentConfig().priorart ?? {};
    const dataDir = process.env.DATA_DIR || process.cwd();
    const workspaceRoot = path.isAbsolute(pa.workspacePath)
      ? pa.workspacePath
      : path.join(dataDir, pa.workspacePath ?? 'data/priorart/workspaces');

    const abs = path.resolve(p);
    if (!abs.startsWith(path.resolve(workspaceRoot))) {
      return new Response('forbidden', { status: 403 });
    }
    if (!fs.existsSync(abs)) return new Response('not found', { status: 404 });
    const body = fs.readFileSync(abs, 'utf-8');
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/markdown' } });
  } catch (err: any) {
    console.error(`[priorart/memo] ${err.message}`);
    return new Response('error', { status: 500 });
  }
};
