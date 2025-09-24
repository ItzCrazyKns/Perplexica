import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// Cache config
const CACHE_DIR = path.join(os.tmpdir(), 'perplexica-embedding-cache');
const CACHE_MAX_ENTRIES = 2000;
const CACHE_TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export type CachedEmbedding = {
  provider: string;
  model: string;
  contentHash: string;
  content: string;
  embedding: number[];
  createdAt: number;
  lastAccess: number;
};

type CacheMeta = {
  path: string;
  provider: string;
  model: string;
  contentHash: string;
  createdAt: number;
  lastAccess: number;
};

// In-memory metadata: cacheKey -> { path, provider, model, contentHash, createdAt, lastAccess }
const memoryCache = new Map<string, CacheMeta>();

async function ensureCacheDir() {
  try {
    await fsp.mkdir(CACHE_DIR, { recursive: true });
  } catch {}
}

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getCacheKey(
  provider: string,
  model: string,
  contentHash: string,
): string {
  return `${provider}:${model}:${contentHash}`;
}

function getCacheFilePath(cacheKey: string): string {
  const safeKey = crypto.createHash('sha256').update(cacheKey).digest('hex');
  return path.join(CACHE_DIR, `${safeKey}.json`);
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const data = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(value), { flush: true });
  await fsp.rename(tmp, filePath);
}

async function scanDiskCache(): Promise<CacheMeta[]> {
  try {
    const entries = await fsp.readdir(CACHE_DIR);
    const metas: CacheMeta[] = [];
    await Promise.all(
      entries
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          const filePath = path.join(CACHE_DIR, f);
          const rec = await readJsonFile<CachedEmbedding>(filePath);
          if (!rec || !rec.provider || !rec.model || !rec.contentHash) return;
          metas.push({
            path: filePath,
            provider: rec.provider,
            model: rec.model,
            contentHash: rec.contentHash,
            createdAt: rec.createdAt,
            lastAccess: rec.lastAccess ?? rec.createdAt,
          });
        }),
    );
    return metas;
  } catch {
    return [];
  }
}

export async function purgeEmbeddingCache() {
  await ensureCacheDir();
  const now = Date.now();
  const metas = await scanDiskCache();

  // Purge expired by TTL
  const expired = metas.filter((m) => now - m.lastAccess > CACHE_TTL_MS);
  await Promise.all(
    expired.map(async (m) => {
      try {
        await fsp.unlink(m.path);
      } catch {}
      const cacheKey = getCacheKey(m.provider, m.model, m.contentHash);
      memoryCache.delete(cacheKey);
      console.log(
        `[embeddingCache] Purged expired cache entry for provider: ${m.provider}, model: ${m.model}`,
      );
    }),
  );

  // Re-scan count after TTL purge
  const remaining = (await scanDiskCache()).filter(
    (m) => now - m.lastAccess <= CACHE_TTL_MS,
  );

  // Purge LRU if exceeds max entries
  if (remaining.length > CACHE_MAX_ENTRIES) {
    const toRemove = remaining
      .sort((a, b) => a.lastAccess - b.lastAccess)
      .slice(0, remaining.length - CACHE_MAX_ENTRIES);
    await Promise.all(
      toRemove.map(async (m) => {
        try {
          await fsp.unlink(m.path);
        } catch {}
        const cacheKey = getCacheKey(m.provider, m.model, m.contentHash);
        memoryCache.delete(cacheKey);
        console.log(
          `[embeddingCache] Purged LRU cache entry for provider: ${m.provider}, model: ${m.model}`,
        );
      }),
    );
    console.log(
      `[embeddingCache] Purged ${toRemove.length} LRU entries to maintain max cache size.`,
    );
  }
}

export async function loadCachedEmbedding(
  provider: string,
  model: string,
  content: string,
): Promise<number[] | null> {
  await ensureCacheDir();
  const contentHash = hashContent(content);
  const cacheKey = getCacheKey(provider, model, contentHash);
  const filePath = getCacheFilePath(cacheKey);

  if (!fs.existsSync(filePath)) return null;

  const rec = await readJsonFile<CachedEmbedding>(filePath);
  if (!rec) return null;

  const now = Date.now();
  const age = now - (rec.lastAccess ?? rec.createdAt ?? now);
  if (age > CACHE_TTL_MS) {
    try {
      await fsp.unlink(filePath);
    } catch {}
    memoryCache.delete(cacheKey);
    console.log(
      `[embeddingCache] Cache miss (expired) for provider: ${provider}, model: ${model}`,
    );
    return null;
  }

  // Update lastAccess and in-memory metadata
  rec.lastAccess = now;
  await writeJsonFile(filePath, rec);
  memoryCache.set(cacheKey, {
    path: filePath,
    provider,
    model,
    contentHash,
    createdAt: rec.createdAt,
    lastAccess: rec.lastAccess,
  });

  console.log(
    `[embeddingCache] Cache hit for provider: ${provider}, model: ${model}`,
  );

  return rec.embedding;
}

export async function writeCachedEmbedding(
  provider: string,
  model: string,
  content: string,
  embedding: number[],
) {
  await ensureCacheDir();
  const now = Date.now();
  const contentHash = hashContent(content);
  const cacheKey = getCacheKey(provider, model, contentHash);
  const filePath = getCacheFilePath(cacheKey);

  const toWrite: CachedEmbedding = {
    provider,
    model,
    contentHash,
    content,
    embedding,
    createdAt: now,
    lastAccess: now,
  };

  await writeJsonFile(filePath, toWrite);
  memoryCache.set(cacheKey, {
    path: filePath,
    provider,
    model,
    contentHash,
    createdAt: now,
    lastAccess: now,
  });

  console.log(
    `[embeddingCache] Cached new embedding for provider: ${provider}, model: ${model}`,
  );
}
