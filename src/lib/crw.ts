import { getCrwURL, getCrwApiKey } from './config/serverRegistry';

export interface CrwSearchOptions {
  limit?: number;
  sources?: string[];
}

interface CrwSearchResult {
  title: string;
  url: string;
  content?: string;
  markdown?: string;
}

/* Raw /v1/search result item as returned by the fastCRW API. */
interface CrwApiSearchResult {
  title: string;
  url: string;
  description?: string;
  markdown?: string;
}

/*
 * fastCRW is a Firecrawl-compatible web data engine (single Rust binary;
 * self-host or cloud). This mirrors searchSearxng and returns the same shape
 * by mapping fastCRW's /v1/search results onto SearXNG-style results.
 */
export const searchCrw = async (query: string, opts?: CrwSearchOptions) => {
  const crwURL = getCrwURL();
  const crwApiKey = getCrwApiKey();

  const url = new URL(`${crwURL}/v1/search`);

  const body: { query: string; limit?: number; sources?: string[] } = {
    query,
  };

  if (opts) {
    if (opts.limit !== undefined) body.limit = opts.limit;
    if (opts.sources !== undefined) body.sources = opts.sources;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (crwApiKey) {
      headers['Authorization'] = `Bearer ${crwApiKey}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`fastCRW error: ${res.statusText}`);
    }

    const data = await res.json();

    if (data.success === false) {
      throw new Error(`fastCRW error: ${data.error ?? 'unknown error'}`);
    }

    const results: CrwSearchResult[] = (data.data ?? []).map(
      (r: CrwApiSearchResult) => ({
        title: r.title,
        url: r.url,
        content: r.description,
        markdown: r.markdown,
      }),
    );
    const suggestions: string[] = [];

    return { results, suggestions };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('fastCRW search timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};
