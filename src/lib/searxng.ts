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
  const searxngURL = getSearxngURL().trim();

  if (!searxngURL) {
    console.warn(
      '[searchSearxng] SearXNG URL is not configured. Returning empty results.',
    );
    return {
      results: [] as SearxngSearchResult[],
      suggestions: [] as string[],
    };
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(searxngURL);
  } catch {
    throw new Error(
      `[searchSearxng] Invalid SearXNG URL configured: "${searxngURL}".`,
    );
  }

  const url = new URL('/search', baseUrl);
  url.searchParams.append('format', 'json');
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

  const res = await fetch(url);

  let body: string | null = null;
  if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
    body = await res.text();
  }

  if (!res.ok) {
    console.error(
      `[searchSearxng] Request failed with status ${res.status}: ${(body ?? '').slice(0, 200)}`,
    );
    throw new Error(`SearXNG request failed with status ${res.status}`);
  }

  let data: any;
  try {
    data = body ? JSON.parse(body) : await res.json();
  } catch (jsonErr) {
    console.error(
      '[searchSearxng] Failed to parse JSON response:', jsonErr,
      'Response snippet:', (body ?? '').slice(0, 200),
    );
    throw new Error('SearXNG response was not valid JSON.');
  }


  const results: SearxngSearchResult[] = data.results;
  const suggestions: string[] = data.suggestions;

  return { results, suggestions };
};
