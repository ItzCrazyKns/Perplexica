import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// Cache config
const CACHE_DIR = path.join(os.tmpdir(), 'perplexica-webcache');
const CACHE_MAX_ENTRIES = 200;
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export type CachedRecord = {
  url: string;
  createdAt: number;
  lastAccess: number;
  title?: string;
  pageContent: string;
  html?: string;
};

type CacheMeta = {
  path: string;
  url: string;
  createdAt: number;
  lastAccess: number;
};

// In-memory metadata: url -> { path, url, createdAt, lastAccess }
const memoryCache = new Map<string, CacheMeta>();

async function ensureCacheDir() {
  try {
    await fsp.mkdir(CACHE_DIR, { recursive: true });
  } catch {}
}

function hashUrl(url: string) {
  return crypto.createHash('sha256').update(url).digest('hex');
}

function getCacheFilePath(url: string) {
  return path.join(CACHE_DIR, `${hashUrl(url)}.json`);
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
  await fsp.writeFile(tmp, JSON.stringify(value));
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
          const rec = await readJsonFile<CachedRecord>(filePath);
          if (!rec || !rec.url) return;
          metas.push({
            path: filePath,
            url: rec.url,
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

export async function purgeWebCache() {
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
      memoryCache.delete(m.url);
      console.log(`[webCache] Purged expired cache entry for URL: ${m.url}`);
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
        memoryCache.delete(m.url);
        console.log(`[webCache] Purged LRU cache entry for URL: ${m.url}`);
      }),
    );
    console.log(
      `[webCache] Purged ${toRemove.length} LRU entries to maintain max cache size.`,
    );
  }
}

export async function loadCachedRecord(
  url: string,
): Promise<CachedRecord | null> {
  await ensureCacheDir();
  const filePath = getCacheFilePath(url);
  if (!fs.existsSync(filePath)) return null;
  const rec = await readJsonFile<CachedRecord>(filePath);
  if (!rec) return null;

  const now = Date.now();
  const age = now - (rec.lastAccess ?? rec.createdAt ?? now);
  if (age > CACHE_TTL_MS) {
    try {
      await fsp.unlink(filePath);
    } catch {}
    memoryCache.delete(url);
    console.log(`[webCache] Cache miss (expired) for URL: ${url}`);
    return null;
  }

  // Update lastAccess and in-memory metadata
  rec.lastAccess = now;
  await writeJsonFile(filePath, rec);
  memoryCache.set(url, {
    path: filePath,
    url,
    createdAt: rec.createdAt,
    lastAccess: rec.lastAccess,
  });

  console.log(`[webCache] Cache hit for URL: ${url}`);

  return rec;
}

export async function writeCachedRecord(
  url: string,
  record: Omit<CachedRecord, 'createdAt' | 'lastAccess' | 'url'>,
) {
  await ensureCacheDir();
  const now = Date.now();
  const filePath = getCacheFilePath(url);
  const toWrite: CachedRecord = {
    url,
    createdAt: now,
    lastAccess: now,
    ...record,
  };
  await writeJsonFile(filePath, toWrite);
  memoryCache.set(url, {
    path: filePath,
    url,
    createdAt: now,
    lastAccess: now,
  });
  console.log(`[webCache] Cached new content for URL: ${url}`);
}
