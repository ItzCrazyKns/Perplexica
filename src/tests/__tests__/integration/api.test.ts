import express from 'express';
import request from 'supertest';
import { SearchService } from '../../../lib/services/searchService';
import { Business } from '../../../lib/types';

// Mock SearchService
jest.mock('../../../lib/services/searchService');

describe('API Integration', () => {
  let app: express.Application;
  
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

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mock SearchService methods
    (SearchService.prototype.search as jest.Mock).mockResolvedValue([mockBusiness]);
    (SearchService.prototype.getBusinessById as jest.Mock).mockResolvedValue(mockBusiness);
    
    // Add error handling middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
      next(err);
    });

    // Add routes
    app.use('/api', require('../../../routes/api').default);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Search Endpoints', () => {
    it('should handle search requests', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'plumber in Denver',
          location: 'Denver, CO'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body.results[0]).toEqual(mockBusiness);
    });

    it('should handle missing parameters', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'plumber in Denver'
          // missing location
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle search errors', async () => {
      // Mock search error
      (SearchService.prototype.search as jest.Mock)
        .mockRejectedValueOnce(new Error('Search failed'));

      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'plumber in Denver',
          location: 'Denver, CO'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Business Details Endpoint', () => {
    it('should retrieve business details', async () => {
      const response = await request(app)
        .get('/api/business/test_1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBusiness);
    });

    it('should handle non-existent business', async () => {
      // Mock not found
      (SearchService.prototype.getBusinessById as jest.Mock)
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/business/non_existent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/search')
        .set('Content-Type', 'application/json')
        .send('{"invalid json"}');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid JSON');
    });

    it('should handle rate limiting', async () => {
      // Mock rate limit error
      (SearchService.prototype.search as jest.Mock)
        .mockRejectedValueOnce({ response: { status: 429 } });

      const response = await request(app)
        .post('/api/search')
        .send({
          query: 'plumber in Denver',
          location: 'Denver, CO'
        });

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Rate limit exceeded');
    });
  });
}); 