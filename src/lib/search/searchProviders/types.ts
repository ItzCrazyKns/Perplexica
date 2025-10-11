export interface SearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
  [key: string]: any;
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
  score?: number;
}

export interface SearchProvider {
  /**
   * Performs a search for the given query
   * @param query The search query
   * @param options Search options
   * @returns Search results
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Gets the unique name of the provider
   * @returns The name of the provider
   */
  getName(): string;

  /**
   * Checks if the provider is available
   * @returns true if the provider is available
   */
  isAvailable(): Promise<boolean>;
}

export type SearchProviderNames =
  | 'searxng'
  | 'exa'
  | 'jina-ai'
  | 'tavily'
  | 'firecrawl';
