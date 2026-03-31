import { tavily } from '@tavily/core';
import { getTavilyAPIKey } from './config/serverRegistry';

interface TavilySearchResult {
  title: string;
  url: string;
  content?: string;
}

export const searchTavily = async (query: string) => {
  const apiKey = getTavilyAPIKey();

  if (!apiKey) {
    throw new Error(
      'Tavily API key is not configured. Please set TAVILY_API_KEY.',
    );
  }

  const client = tavily({ apiKey });

  const response = await client.search(query, {
    maxResults: 10,
    searchDepth: 'basic',
    topic: 'general',
  });

  const results: TavilySearchResult[] = (response.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));

  const suggestions: string[] = [];

  return { results, suggestions };
};
