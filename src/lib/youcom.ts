import { SearxngSearchResult, SearxngSearchOptions } from './searxng';
import { mapYoucomResults } from './youcomMap';
import { getYoucomApiKey } from './config/serverRegistry';

// MINIMAL: You.com Search API has no engine/category/image-specific fields, so
// image/video/discover routes remain SearXNG-only. Upgrade path: add a dedicated
// You.com image search using the `images` array in the API response.

// SearXNG-style opts are accepted but ignored — You.com has no equivalents.
export const searchYoucom = async (
  query: string,
  _opts?: SearxngSearchOptions,
) => {
  const apiKey = getYoucomApiKey();
  if (!apiKey) {
    throw new Error(
      'YDC_API_KEY environment variable is not set. Configure it to use the You.com search provider.',
    );
  }

  const maxResults = 20;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('https://api.you.com/v1/agents/search', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, max_results: maxResults }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`You.com search error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    const results = mapYoucomResults(data.results ?? []) as SearxngSearchResult[];

    return { results, suggestions: [] as string[] };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('You.com search timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};
