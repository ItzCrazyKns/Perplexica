import { createClient } from '@supabase/supabase-js';

// Mock data type
type MockData = {
  businesses: { id: string; name: string };
  cache: { key: string; value: { test: boolean } };
};

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table: keyof MockData) => {
      const mockData: MockData = {
        businesses: { id: 'test_1', name: 'Test Business' },
        cache: { key: 'test_key', value: { test: true } }
      };

      return {
        insert: jest.fn(() => ({
          select: jest.fn().mockResolvedValue({
            data: [mockData[table]],
            error: null
          })
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: mockData[table],
              error: null
            }),
            gt: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            }))
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })),
        delete: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        }))
      };
    })
  }))
}));

describe('Database Operations', () => {
  const supabase = createClient('test-url', 'test-key');
  
  const testBusiness = {
    id: `test_${Date.now()}`,
    name: 'Test Business',
    phone: '(303) 555-1234',
    email: 'test@example.com',
    address: '123 Test St, Denver, CO 80202',
    rating: 5,
    website: 'https://test.com',
    source: 'test',
    description: 'Test description',
    location: { lat: 39.7392, lng: -104.9903 },
    search_count: 1,
    created_at: new Date().toISOString()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Business Operations', () => {
    it('should insert a business successfully', async () => {
      const { data, error } = await supabase
        .from('businesses')
        .insert([testBusiness])
        .select();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data![0].name).toBe('Test Business');
    });

    it('should retrieve a business by id', async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select()
        .eq('id', testBusiness.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.name).toBe('Test Business');
    });

    it('should update a business', async () => {
      const { error } = await supabase
        .from('businesses')
        .update({ name: 'Updated Test Business' })
        .eq('id', testBusiness.id);

      expect(error).toBeNull();
    });
  });

  describe('Cache Operations', () => {
    const testCache = {
      key: `test_key_${Date.now()}`,
      value: { test: true },
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString()
    };

    it('should insert cache entry', async () => {
      const { data, error } = await supabase
        .from('cache')
        .insert([testCache])
        .select();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
    });

    it('should retrieve cache entry', async () => {
      const { data, error } = await supabase
        .from('cache')
        .select()
        .eq('key', testCache.key)
        .single();

      expect(error).toBeNull();
      expect(data.value).toEqual({ test: true });
    });
  });
}); 