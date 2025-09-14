import axios from 'axios';
import { getSearxngApiEndpoint } from './config';

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

interface SearxngResponse {
  results: SearxngSearchResult[];
  suggestions: string[];
  searchUrl: string;
}

export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  const searxngURL = getSearxngApiEndpoint();

  console.log('[searchSearxng] Searching:', query, opts);
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

  const res = await axios.get(url.toString());

  const results: SearxngSearchResult[] = res.data.results;
  const suggestions: string[] = res.data.suggestions;

  // Create a URL for viewing the search results in the SearXNG web interface
  const searchUrl = new URL(searxngURL);
  searchUrl.pathname = '/search';
  searchUrl.searchParams.append('q', query);
  if (opts?.engines?.length) {
    searchUrl.searchParams.append('engines', opts.engines.join(','));
  }
  if (opts?.language) {
    searchUrl.searchParams.append('language', opts.language);
  }

  console.log(
    `[searchSearxng] Search for "${query}" returned ${results.length} results`,
  );

  return { results, suggestions, searchUrl: searchUrl.toString() };
};
