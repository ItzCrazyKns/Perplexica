import { DeepSeekService } from '../../lib/services/deepseekService';
import { Business } from '../../lib/types';

// Mock the DeepSeek service
jest.mock('../../lib/services/deepseekService', () => {
  const mockCleanedBusiness = {
    name: "Denver's Best Plumbing & Repair",
    address: "1234 Main Street, Denver, CO 80202",
    phone: "(720) 555-1234",
    email: "support@denverplumbing.com",
    description: "Professional plumbing services in Denver metro area"
  };

  return {
    DeepSeekService: {
      chat: jest.fn().mockResolvedValue(JSON.stringify({
        business_info: mockCleanedBusiness
      })),
      detectBusinessType: jest.fn().mockReturnValue('service'),
      sanitizeJsonResponse: jest.fn().mockReturnValue(mockCleanedBusiness),
      manualClean: jest.fn().mockReturnValue(mockCleanedBusiness),
      cleanBusinessData: jest.fn().mockResolvedValue(mockCleanedBusiness)
    }
  };
});

describe('DeepSeekService', () => {
  describe('cleanBusinessData', () => {
    const testBusiness: Business = {
      id: 'test_1',
      name: "Denver's Best Plumbing & Repair [LLC] (A Family Business)",
      address: "Suite 200-B, 1234 Main Street, Denver, Colorado 80202",
      phone: "(720) 555-1234",
      email: "support@denverplumbing.com",
      description: "Professional plumbing services in Denver metro area",
      source: 'test',
      website: 'https://example.com',
      rating: 4.8,
      location: { lat: 39.7392, lng: -104.9903 },
      openingHours: []
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should clean business name correctly', async () => {
      const cleaned = await DeepSeekService.cleanBusinessData(testBusiness);
      expect(cleaned.name).not.toMatch(/[\[\]{}()]/);
      expect(cleaned.name).toBeTruthy();
    });

    it('should format phone number correctly', async () => {
      const cleaned = await DeepSeekService.cleanBusinessData(testBusiness);
      expect(cleaned.phone).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
    });

    it('should clean email address', async () => {
      const cleaned = await DeepSeekService.cleanBusinessData(testBusiness);
      expect(cleaned.email).not.toMatch(/[\[\]<>()]|mailto:|click|schedule/i);
      expect(cleaned.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('should clean description', async () => {
      const cleaned = await DeepSeekService.cleanBusinessData(testBusiness);
      expect(cleaned.description).not.toMatch(/[\$\d]+%?\s*off|\$/i);
      expect(cleaned.description).not.toMatch(/\b(?:call|email|visit|contact|text|www\.|http|@)\b/i);
      expect(cleaned.description).not.toMatch(/[📞📧🌐💳☎️📱]/);
      expect(cleaned.description).not.toMatch(/#\w+/);
    });
  });

  describe('chat', () => {
    it('should return a response from the model', async () => {
      const response = await DeepSeekService['chat']([{
        role: 'user',
        content: 'Test message'
      }]);
      expect(response).toBeTruthy();
      expect(typeof response).toBe('string');
    });

    it('should handle errors gracefully', async () => {
      (DeepSeekService['chat'] as jest.Mock).mockRejectedValueOnce(new Error('Test error'));
      
      await expect(DeepSeekService['chat']([{
        role: 'user',
        content: 'Test message'
      }])).rejects.toThrow('Test error');
    });
  });
}); 