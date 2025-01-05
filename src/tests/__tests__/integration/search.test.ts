import { DeepSeekService } from '../../../lib/services/deepseekService';
import { createClient } from '@supabase/supabase-js';
import { SearchService } from '../../../lib/services/searchService';
import { Business } from '../../../lib/types';

// Mock external services
jest.mock('@supabase/supabase-js');
jest.mock('../../../lib/services/deepseekService');

describe('Search Integration', () => {
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

  // Mock Supabase responses
  const mockSupabase = {
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [mockBusiness],
          error: null
        })
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      })
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('Search and Store Flow', () => {
    it('should search, clean, and store business data', async () => {
      const searchService = new SearchService();
      const query = 'plumber in Denver';
      const location = 'Denver, CO';

      // Mock performSearch to return results
      const performSearchSpy = jest.spyOn(searchService as any, 'performSearch')
        .mockResolvedValue([mockBusiness]);

      // Perform search
      const results = await searchService.search(query, location);

      // Verify search results
      expect(results).toBeTruthy();
      expect(Array.isArray(results)).toBe(true);
      expect(results[0]).toEqual(mockBusiness);
      
      // Verify cache was checked first
      expect(mockSupabase.from).toHaveBeenCalledWith('cache');
      
      // Verify results were cached
      expect(mockSupabase.from).toHaveBeenCalledWith('cache');
      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });

    it('should handle search errors gracefully', async () => {
      const searchService = new SearchService();
      
      // Mock performSearch to throw error
      jest.spyOn(searchService as any, 'performSearch')
        .mockRejectedValue(new Error('Search failed'));

      await expect(searchService.search('invalid query', 'invalid location'))
        .rejects.toThrow('Search failed');
    });

    it('should use cache when available', async () => {
      const searchService = new SearchService();
      const query = 'plumber in Denver';
      const location = 'Denver, CO';

      // Mock cache hit
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { value: [mockBusiness] },
              error: null
            })
          })
        })
      });

      const results = await searchService.search(query, location);

      // Verify cache was checked
      expect(mockSupabase.from).toHaveBeenCalledWith('cache');
      expect(results).toEqual([mockBusiness]);

      // Verify performSearch was not called
      expect(jest.spyOn(searchService as any, 'performSearch')).not.toHaveBeenCalled();
    });

    it('should handle rate limiting', async () => {
      const searchService = new SearchService();
      
      // Mock performSearch to throw rate limit error
      jest.spyOn(searchService as any, 'performSearch')
        .mockRejectedValue({ response: { status: 429 } });

      const query = 'plumber in Denver';
      const location = 'Denver, CO';

      await expect(searchService.search(query, location))
        .rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency between search and retrieval', async () => {
      const searchService = new SearchService();
      const query = 'plumber in Denver';
      const location = 'Denver, CO';

      // Mock performSearch to return results
      jest.spyOn(searchService as any, 'performSearch')
        .mockResolvedValue([mockBusiness]);

      // Perform search
      const searchResults = await searchService.search(query, location);
      const firstResult = searchResults[0];

      // Mock database retrieval
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: firstResult,
              error: null
            })
          })
        })
      });

      // Retrieve the same business
      const retrieved = await searchService.getBusinessById(firstResult.id);

      // Verify data consistency
      expect(retrieved).toEqual(firstResult);
    });
  });
}); 