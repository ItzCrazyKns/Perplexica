import db from '@/lib/db';
import { spaces } from '@/lib/db/schema';
import { SpaceWebSource } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import ModelRegistry from '@/lib/models/registry';
import UploadManager from '@/lib/uploads/manager';
import Scraper from '@/lib/scraper';
import { splitText } from '@/lib/utils/splitText';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const rawDb = new Database(path.join(process.cwd(), './data/db.sqlite'));

const BACKGROUND_TASK_TIMEOUT_MS = 60_000;

function getSources(spaceId: string): SpaceWebSource[] {
  const row = rawDb.prepare('SELECT webSources FROM spaces WHERE id = ?').get(spaceId) as { webSources: string } | undefined;
  if (!row) throw new Error('Space not found');
  return JSON.parse(row.webSources || '[]');
}

function updateSource(spaceId: string, sourceId: string, patch: Partial<SpaceWebSource>) {
  const updateTx = rawDb.transaction(() => {
    const current = getSources(spaceId);
    const updated = current.map((s) => (s.id === sourceId ? { ...s, ...patch } : s));
    rawDb.prepare('UPDATE spaces SET webSources = ?, updatedAt = ? WHERE id = ?').run(
      JSON.stringify(updated),
      new Date().toISOString(),
      spaceId,
    );
    return updated;
  });
  return updateTx();
}

async function scrapeAndEmbed(
  spaceId: string,
  sourceId: string,
  url: string,
  embeddingModelProviderId: string,
  embeddingModelKey: string,
): Promise<void> {
  try {
    const registry = new ModelRegistry();
    const embeddingModel = await registry.loadEmbeddingModel(embeddingModelProviderId, embeddingModelKey);

    const { content, title } = await Scraper.scrape(url);

    const chunks = splitText(content, 512, 128);
    if (chunks.length === 0) throw new Error('No content extracted from URL');

    const embeddings = await embeddingModel.embedText(chunks);
    if (embeddings.length !== chunks.length) throw new Error('Embedding count mismatch');

    if (!fs.existsSync(UploadManager.uploadsDir)) {
      fs.mkdirSync(UploadManager.uploadsDir, { recursive: true });
    }

    const fileId = crypto.randomBytes(16).toString('hex');
    const contentPath = path.join(UploadManager.uploadsDir, `${fileId}.content.json`);

    fs.writeFileSync(contentPath, JSON.stringify({
      chunks: chunks.map((c, i) => ({ content: c, embedding: embeddings[i] })),
    }, null, 2));

    const recordPath = UploadManager.uploadedFilesRecordPath;
    const recordData = fs.existsSync(recordPath)
      ? JSON.parse(fs.readFileSync(recordPath, 'utf-8'))
      : { files: [] };

    recordData.files.push({
      id: fileId,
      name: title || url,
      filePath: contentPath,
      contentPath,
      uploadedAt: new Date().toISOString(),
    });

    fs.writeFileSync(recordPath, JSON.stringify(recordData, null, 2));

    updateSource(spaceId, sourceId, { status: 'ready', fileId, title: title || url, error: null });
  } catch (err: any) {
    updateSource(spaceId, sourceId, {
      status: 'failed',
      error: err?.message || 'Unknown error',
    });
  }
}

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const { url, embeddingModelKey, embeddingModelProviderId } = body;

    if (!embeddingModelKey || !embeddingModelProviderId) {
      return Response.json(
        { message: 'Embedding model is not configured. Please configure it in Settings before adding sources.' },
        { status: 400 },
      );
    }

    if (!url?.trim()) {
      return Response.json({ message: 'URL is required.' }, { status: 400 });
    }

    const space = await db.query.spaces.findFirst({ where: eq(spaces.id, id) });
    if (!space) {
      return Response.json({ message: 'Space not found' }, { status: 404 });
    }

    const sourceId = crypto.randomBytes(16).toString('hex');
    const newSource: SpaceWebSource = {
      id: sourceId,
      url: url.trim(),
      title: url.trim(),
      fileId: null,
      status: 'pending',
      error: null,
      addedAt: new Date().toISOString(),
    };

    const addSourceTx = rawDb.transaction(() => {
      const current = getSources(id);
      const updated = [...current, newSource];
      rawDb.prepare('UPDATE spaces SET webSources = ?, updatedAt = ? WHERE id = ?').run(
        JSON.stringify(updated),
        new Date().toISOString(),
        id,
      );
      return updated;
    });
    addSourceTx();

    // Fire-and-forget background task wrapped in a hard 60s timeout.
    // Always writes a terminal status (ready/failed) — source never sticks in pending.
    // TODO: future upgrade — replace poll with SSE status event (Vane already streams chat over SSE).
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Scrape+embed timed out after 60s')), BACKGROUND_TASK_TIMEOUT_MS),
    );

    Promise.race([
      scrapeAndEmbed(id, sourceId, url.trim(), embeddingModelProviderId, embeddingModelKey),
      timeoutPromise,
    ]).catch((err: any) => {
      updateSource(id, sourceId, {
        status: 'failed',
        error: err?.message || 'Background task timed out',
      });
    });

    return Response.json({ source: newSource }, { status: 202 });
  } catch (err) {
    console.error('Error adding source to space:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const { sourceId } = await req.json();

    const space = await db.query.spaces.findFirst({ where: eq(spaces.id, id) });
    if (!space) {
      return Response.json({ message: 'Space not found' }, { status: 404 });
    }

    const removeSourceTx = rawDb.transaction(() => {
      const current = getSources(id);
      const updated = current.filter((s) => s.id !== sourceId);
      rawDb.prepare('UPDATE spaces SET webSources = ?, updatedAt = ? WHERE id = ?').run(
        JSON.stringify(updated),
        new Date().toISOString(),
        id,
      );
      return updated;
    });

    const updatedSources = removeSourceTx();

    return Response.json({ sources: updatedSources }, { status: 200 });
  } catch (err) {
    console.error('Error removing source from space:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};

export const PATCH = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const { sourceId, embeddingModelKey, embeddingModelProviderId } = await req.json();

    if (!embeddingModelKey || !embeddingModelProviderId) {
      return Response.json(
        { message: 'Embedding model is not configured. Please configure it in Settings before refreshing sources.' },
        { status: 400 },
      );
    }

    const space = await db.query.spaces.findFirst({ where: eq(spaces.id, id) });
    if (!space) {
      return Response.json({ message: 'Space not found' }, { status: 404 });
    }

    const sources = getSources(id);
    const source = sources.find((s) => s.id === sourceId);
    if (!source) {
      return Response.json({ message: 'Source not found' }, { status: 404 });
    }

    updateSource(id, sourceId, { status: 'pending', error: null });

    // Same 60s hard timeout for retry/refresh
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Scrape+embed timed out after 60s')), BACKGROUND_TASK_TIMEOUT_MS),
    );

    Promise.race([
      scrapeAndEmbed(id, sourceId, source.url, embeddingModelProviderId, embeddingModelKey),
      timeoutPromise,
    ]).catch((err: any) => {
      updateSource(id, sourceId, {
        status: 'failed',
        error: err?.message || 'Background task timed out',
      });
    });

    return Response.json({ message: 'Refresh started' }, { status: 202 });
  } catch (err) {
    console.error('Error refreshing source:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};
