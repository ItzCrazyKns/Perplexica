/**
 * Search provider types and interfaces
 */

export interface SearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  suggestions: string[];
}

/**
 * Base interface that all search providers must implement
 */
export interface SearchProvider {
  /**
   * Performs a search query
   * @param query The search query string
   * @param opts Optional search parameters
   * @returns Promise with search results and suggestions
   */
  search(query: string, opts?: SearchOptions): Promise<SearchResponse>;
}
