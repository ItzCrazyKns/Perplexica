/**
 * @deprecated This file is kept for backward compatibility.
 * Please use the new search provider system instead:
 * import { search } from './search/providers';
 *
 * The new system supports multiple search providers (SearxNG, Google Custom Search, etc.)
 * Configure via config.toml [SEARCH] section.
 */

import { search } from './search/providers';
import type { SearchOptions, SearchResponse } from './search/providers';

// Re-export types for backward compatibility
export interface SearxngSearchOptions extends SearchOptions {}
export interface SearxngSearchResult {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
}

/**
 * @deprecated Use the new `search()` function from './search/providers' instead
 * This function now delegates to the configured search provider
 */
export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
): Promise<SearchResponse> => {
  return search(query, opts);
};
