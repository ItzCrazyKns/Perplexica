import axios from 'axios';
import { config } from '../config';

interface SearchOptions {
  maxResults?: number;
  type?: 'general' | 'news';
  engines?: string[];
}

interface SearchResult {
  url: string;
  title: string;
  content: string;
  score?: number;
}

export async function searchWeb(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    maxResults = 20,
    type = 'general',
    engines = ['google', 'bing', 'duckduckgo']
  } = options;

  try {
    const response = await axios.get(`${config.search.searxngUrl || process.env.SEARXNG_URL}/search`, {
      params: {
        q: query,
        format: 'json',
        categories: type,
        engines: engines.join(','),
        limit: maxResults
      }
    });

    if (!response.data || !response.data.results) {
      console.error('Invalid response from SearxNG:', response.data);
      return [];
    }

    return response.data.results.map((result: any) => ({
      url: result.url,
      title: result.title,
      content: result.content || result.snippet || '',
      score: result.score
    }));

  } catch (error) {
    console.error('Search failed:', error);
    throw error;
  }
} 