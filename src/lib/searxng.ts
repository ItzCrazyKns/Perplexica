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

export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  const searxngURL = getSearxngApiEndpoint();

  try {
    const url = new URL(`${searxngURL}/search?format=json`);
    url.searchParams.append('q', query ?? '');

    if (opts) {
      Object.keys(opts).forEach((key) => {
        const value = opts[key as keyof SearxngSearchOptions];
        if (Array.isArray(value)) {
          url.searchParams.append(key, value.join(','));
          return;
        }
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const res = await axios.get(url.toString(), {
      // Fail fast so the UI doesn't hang when SearXNG is down/unreachable
      timeout: 6000,
      // Avoid throwing on non-2xx; we'll handle gracefully below
      validateStatus: () => true,
    });

    if (res.status >= 200 && res.status < 300 && res.data) {
      const results: SearxngSearchResult[] = res.data.results ?? [];
      const suggestions: string[] = res.data.suggestions ?? [];
      return { results, suggestions };
    }

    // Graceful fallback on HTTP errors
    console.warn(
      `SearXNG returned ${res.status} for ${url.toString()} — returning empty results`,
    );
    return { results: [], suggestions: [] };
  } catch (err) {
    // ECONNREFUSED / timeouts etc. — do not crash chains/API routes
    console.warn(
      `SearXNG request failed (${(err as any)?.code || 'unknown'}) — returning empty results`,
    );
    return { results: [], suggestions: [] };
  }
};
