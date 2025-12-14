import { searchSearxng } from '@/lib/searxng';

// Mock the config
jest.mock('@/lib/config/serverRegistry', () => ({
  getSearxngURL: jest.fn(() => 'http://localhost:4000'),
}));

global.fetch = jest.fn();

describe('searchSearxng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return search results for successful request', async () => {
    const mockResults = {
      results: [{ title: 'Test', url: 'http://test.com' }],
      suggestions: ['test suggestion'],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn(() => 'application/json'),
      },
      json: jest.fn().mockResolvedValue(mockResults),
    });

    const result = await searchSearxng('test query');

    expect(result).toEqual(mockResults);
  });

  it('should throw error when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(searchSearxng('test query')).rejects.toThrow(
      'SearXNG request failed: 500 Internal Server Error'
    );
  });

  it('should throw error when content-type is not JSON', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn(() => 'text/html'),
      },
    });

    await expect(searchSearxng('test query')).rejects.toThrow(
      'SearXNG did not return JSON'
    );
  });

  it('should handle network errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(
      new TypeError('fetch failed')
    );

    await expect(searchSearxng('test query')).rejects.toThrow(
      'Failed to connect to SearXNG at http://localhost:4000'
    );
  });

  it('should return empty arrays when results/suggestions are missing', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn(() => 'application/json'),
      },
      json: jest.fn().mockResolvedValue({}),
    });

    const result = await searchSearxng('test query');

    expect(result).toEqual({
      results: [],
      suggestions: [],
    });
  });

  it('should handle query with special characters', async () => {
    const mockResults = {
      results: [],
      suggestions: [],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: {
        get: jest.fn(() => 'application/json'),
      },
      json: jest.fn().mockResolvedValue(mockResults),
    });

    await searchSearxng('test & query with "quotes"');

    expect(global.fetch).toHaveBeenCalled();
    const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(callUrl.toString()).toContain('test+%26+query');
  });
});
