import { NextResponse } from 'next/server';
import process from 'process';

// In-memory cache for configuration data
let cachedConfig: { [key: string]: string } ;
let cacheTimestamp: number | null = null;

const CACHE_DURATION_MS = 5 * 60 * 1000; // Cache duration: 5 minutes

async function fetchConfig() {
  try {
    const response = await fetch('/api/env');
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

export async function getServerEnv(envVar: string): Promise<string | undefined> {
  // Check if the cache is still valid
  if (cachedConfig && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedConfig[envVar] || process.env[envVar];
  }

  // Fetch and cache the config if not in cache or cache is expired
  await fetchConfig();
  return cachedConfig[envVar];
}
