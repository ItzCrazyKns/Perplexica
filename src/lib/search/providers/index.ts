import { getSearchProvider } from '../../config';
import type { SearchProvider, SearchOptions, SearchResponse } from './types';
import { SearxngProvider } from './searxng';
import { GoogleCustomSearchProvider } from './googleCustomSearch';

let searchProviderInstance: SearchProvider | null = null;

/**
 * Get the configured search provider instance
 * Uses singleton pattern to avoid re-instantiating the provider
 */
export const getSearchProviderInstance = (): SearchProvider => {
  if (!searchProviderInstance) {
    const providerName = getSearchProvider();

    switch (providerName.toLowerCase()) {
      case 'google_custom_search':
      case 'google':
        searchProviderInstance = new GoogleCustomSearchProvider();
        break;
      case 'searxng':
      default:
        searchProviderInstance = new SearxngProvider();
        break;
    }
  }

  return searchProviderInstance;
};

/**
 * Main search function - delegates to the configured provider
 * This is the function that should be imported and used throughout the app
 */
export const search = async (
  query: string,
  opts?: SearchOptions,
): Promise<SearchResponse> => {
  const provider = getSearchProviderInstance();
  return provider.search(query, opts);
};

// Re-export types for convenience
export type { SearchProvider, SearchOptions, SearchResponse, SearchResult } from './types';
