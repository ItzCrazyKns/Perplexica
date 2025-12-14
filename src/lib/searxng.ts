import axios from 'axios';
import { getSearxngURL } from './config/serverRegistry';

interface SearxngSearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
}

interface SearxngSearchResult {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
}

export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  const searxngURL = getSearxngURL();

  const url = new URL(`${searxngURL}/search?format=json`);
  url.searchParams.append('q', query);

  if (opts) {
    Object.keys(opts).forEach((key) => {
      const value = opts[key as keyof SearxngSearchOptions];
      if (Array.isArray(value)) {
        url.searchParams.append(key, value.join(','));
        return;
      }
      url.searchParams.append(key, value as string);
    });
  }

  try {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(
        `SearXNG request failed: ${res.status} ${res.statusText}`,
      );
    }

    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error('SearXNG did not return JSON');
    }

    const data = await res.json();

    const results: SearxngSearchResult[] = data.results || [];
    const suggestions: string[] = data.suggestions || [];

    return { results, suggestions };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`Network error when connecting to SearXNG:`, error);
      throw new Error(`Failed to connect to SearXNG at ${searxngURL}`);
    }
    console.error(`SearXNG search error for query "${query}":`, error);
    throw error;
  }
};
