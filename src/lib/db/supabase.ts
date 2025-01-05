import { createClient } from '@supabase/supabase-js';
import { BusinessData } from '../searxng';
import { env } from '../../config/env';

// Create the Supabase client with validated environment variables
export const supabase = createClient(
  env.supabase.url,
  env.supabase.anonKey,
  {
    auth: {
      persistSession: false // Since this is a server environment
    }
  }
);

// Define the cache record type
export interface CacheRecord {
  id: string;
  query: string;
  results: BusinessData[];
  location: string;
  category: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

// Export database helper functions
export async function getCacheEntry(
  category: string,
  location: string
): Promise<CacheRecord | null> {
  const { data, error } = await supabase
    .from('search_cache')
    .select('*')
    .eq('category', category.toLowerCase())
    .eq('location', location.toLowerCase())
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Cache lookup failed:', error);
    return null;
  }

  return data;
}

export async function saveCacheEntry(
  category: string,
  location: string,
  results: BusinessData[],
  expiresInDays: number = 7
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { error } = await supabase
    .from('search_cache')
    .insert({
      query: `${category} in ${location}`,
      category: category.toLowerCase(),
      location: location.toLowerCase(),
      results,
      expires_at: expiresAt.toISOString()
    });

  if (error) {
    console.error('Failed to save cache entry:', error);
    throw error;
  }
} 