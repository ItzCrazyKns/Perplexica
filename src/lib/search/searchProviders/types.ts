// A list of all available search providers
export type SearchProviderNames = 'searxng' | 'exa' | 'tavily' | 'firecrawl' | 'jina-ai';

// The interface that all search providers must implement
export interface SearchProvider {
  search(query: string, options?: SearchProviderOptions): Promise<SearchResult[]>;
  getName(): SearchProviderNames;
}

// The structure of a single search result
export interface SearchResult {
  title: string;
  url: string;
  content?: string;
  img_src?: string;
}

// --- Base and specific option types ---

// Base options that all providers should support
export interface BaseSearchOptions {
  count?: number;
  language?: string;
  [key: string]: any; // Allow other properties
}

// SearxNG
export interface SearxngSearchOptions extends BaseSearchOptions {
  engines?: string[];
}

// Exa
export interface ExaSearchOptions extends BaseSearchOptions {
  useAutoprompt?: boolean;
  startCrawlDate?: string;
  endCrawlDate?: string;
  textContentsOnly?: boolean;
  summary?: boolean;
  highlightTitle?: boolean;
  highlightUrl?: boolean;
  highlightText?: boolean;
}

// Tavily
export interface TavilySearchOptions extends BaseSearchOptions {
  searchDepth?: 'basic' | 'advanced';
  topic?: 'general' | 'news' | 'finance';
  days?: number;
  timeRange?: 'd' | 'w' | 'm' | 'y';
  includeImages?: boolean;
  includeAnswer?: boolean;
  includeRawContent?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
}

// Firecrawl
export interface FirecrawlSearchOptions extends BaseSearchOptions {
  formats?: ('markdown' | 'html' | 'rawHtml')[];
  onlyMainContent?: boolean;
  timeout?: number;
  waitFor?: number;
}

// Jina AI
export interface JinaSearchOptions extends BaseSearchOptions {
  noCache?: boolean;
  gatherImages?: boolean;
  gatherLinks?: boolean;
}

// A union type for all possible search options
export type SearchProviderOptions = 
  | BaseSearchOptions 
  | SearxngSearchOptions 
  | ExaSearchOptions 
  | TavilySearchOptions
  | FirecrawlSearchOptions
  | JinaSearchOptions;