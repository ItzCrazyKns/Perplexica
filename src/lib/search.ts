import { searchSearxng, SearxngSearchOptions } from './searxng';
import { searchYoucom } from './youcom';
import { getSearchProvider } from './config/serverRegistry';

export type { SearxngSearchOptions };

// Config-driven dispatcher: routes to SearXNG (default) or You.com based on the
// `search.provider` config value. Only the main web-search path uses this;
// media/discover routes call `searchSearxng` directly (SearXNG engine-specific).
export const searchWeb = async (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  const provider = getSearchProvider();

  if (provider === 'youcom') {
    return searchYoucom(query, opts);
  }

  return searchSearxng(query, opts);
};
