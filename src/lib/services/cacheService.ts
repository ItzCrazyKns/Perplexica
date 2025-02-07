import { supabase } from '../supabase';
import { BusinessData } from '../searxng';

export class CacheService {
  static async getCachedResults(category: string, location: string): Promise<BusinessData[] | null> {
    try {
      const { data, error } = await supabase
        .from('search_cache')
        .select('results')
        .eq('category', category.toLowerCase())
        .eq('location', location.toLowerCase())
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data ? data.results : null;
    } catch (error) {
      console.error('Cache lookup failed:', error);
      return null;
    }
  }

  static async cacheResults(
    category: string, 
    location: string, 
    results: BusinessData[],
    expiresInDays: number = 7
  ): Promise<void> {
    try {
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

      if (error) throw error;
    } catch (error) {
      console.error('Failed to cache results:', error);
    }
  }

  static async updateCache(
    category: string,
    location: string,
    newResults: BusinessData[]
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('search_cache')
        .update({
          results: newResults,
          updated_at: new Date().toISOString()
        })
        .eq('category', category.toLowerCase())
        .eq('location', location.toLowerCase());

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update cache:', error);
    }
  }
} 