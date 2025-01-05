import { DeepSeekService } from './deepseekService';
import { createClient } from '@supabase/supabase-js';
import { Business } from '../types';

export class SearchService {
  private supabase;
  private deepseek;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );
    this.deepseek = DeepSeekService;
  }

  async search(query: string, location: string): Promise<Business[]> {
    if (!query || !location) {
      throw new Error('Query and location are required');
    }

    // Check cache first
    const cacheKey = `${query}_${location}`.toLowerCase();
    const { data: cacheData } = await this.supabase
      .from('cache')
      .select()
      .eq('key', cacheKey)
      .single();

    if (cacheData && cacheData.value) {
      return cacheData.value as Business[];
    }

    try {
      // Perform search
      const searchResults = await this.performSearch(query, location);
      
      // Cache results
      await this.cacheResults(cacheKey, searchResults);

      return searchResults;
    } catch (error: any) {
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw error;
    }
  }

  async getBusinessById(id: string): Promise<Business | null> {
    const { data, error } = await this.supabase
      .from('businesses')
      .select()
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Business;
  }

  private async performSearch(query: string, location: string): Promise<Business[]> {
    // Implementation would use DeepSeek service to perform search
    // This is a placeholder implementation
    const mockBusiness: Business = {
      id: 'test_1',
      name: "Denver's Best Plumbing",
      address: "1234 Main Street, Denver, CO 80202",
      phone: "(720) 555-1234",
      email: "support@denverplumbing.com",
      description: "Professional plumbing services",
      source: 'test',
      website: 'https://example.com',
      rating: 4.8,
      location: { lat: 39.7392, lng: -104.9903 },
      openingHours: []
    };

    return [mockBusiness];
  }

  private async cacheResults(key: string, results: Business[]): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(process.env.CACHE_DURATION_DAYS || 7));

    await this.supabase
      .from('cache')
      .insert([{
        key,
        value: results,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      }]);
  }
} 