import { NextResponse } from 'next/server';

// In-memory cache for configuration data
let cachedConfig: { [key: string]: any } | null = null;
let cacheTimestamp: number | null = null;

const CACHE_DURATION_MS = 5 * 60 * 1000; // Cache duration: 5 minutes

async function fetchConfig() {
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const data = await response.json();
      cachedConfig = data;
      cacheTimestamp = Date.now();
    } else {
      throw new Error('Failed to fetch config');
    }
  } catch (error) {
    console.error('Error fetching config:', error);
    throw error;
  }
}

export async function getServerEnv(envVar: string): Promise<string | null> {
  // Check if the cache is still valid
  if (cachedConfig && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedConfig[envVar] || null;
  }

  // Fetch and cache the config if not in cache or cache is expired
  await fetchConfig();
  return cachedConfig ? cachedConfig[envVar] || null : null;
}
