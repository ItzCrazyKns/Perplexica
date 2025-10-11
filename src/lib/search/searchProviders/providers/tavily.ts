import { getTavilyApiKey } from '@/lib/config';
import {
  SearchProvider,
  SearchProviderNames,
  SearchResult,
  TavilySearchOptions,
} from '../types';
import { tavily } from '@tavily/core';

export interface TavilySearchResult extends SearchResult {
  score?: number;
}

export class TavilyProvider implements SearchProvider {
  private client: any;

  constructor(apiKey?: string) {
    const currentApiKey = apiKey || getTavilyApiKey();
    if (!currentApiKey) {
      throw new Error('Tavily API key is required');
    }
    this.client = tavily({ apiKey: currentApiKey });
  }

  async search(
    query: string,
    opts?: TavilySearchOptions,
  ): Promise<TavilySearchResult[]> {
    try {
      const searchOptions: any = {
        searchDepth: opts?.searchDepth || 'basic',
        topic: opts?.topic || 'general',
        maxResults: opts?.count || 10, // Use common count option
      };

      if (opts?.days) {
        searchOptions.days = opts.days;
      }

      if (opts?.timeRange) {
        searchOptions.timeRange = opts.timeRange;
      }

      if (opts?.includeImages) {
        searchOptions.includeImages = opts.includeImages;
      }

      if (opts?.includeAnswer) {
        searchOptions.includeAnswer = opts.includeAnswer;
      }

      if (opts?.includeRawContent) {
        searchOptions.includeRawContent = opts.includeRawContent;
      }

      if (opts?.includeDomains && opts.includeDomains.length > 0) {
        searchOptions.includeDomains = opts.includeDomains;
      }

      if (opts?.excludeDomains && opts.excludeDomains.length > 0) {
        searchOptions.excludeDomains = opts.excludeDomains;
      }

      const response = await this.client.search(query, searchOptions);

      this.logSearchActivity(query, response.results.length);

      const results = response.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
      }));

      console.log('Tavily search results:', results);
      return results;
    } catch (error) {
      console.error(`Tavily search failed:`, error);
      throw new Error(`Failed to search with Tavily: ${error}`);
    }
  }

  getName(): SearchProviderNames {
    return 'tavily';
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.search('test', { maxResults: 1 });
      return true;
    } catch {
      return false;
    }
  }

  // Method for extracting content from a URL
  async extract(
    urls: string[],
    opts?: { includeImages?: boolean; extractDepth?: 'basic' | 'advanced' },
  ): Promise<TavilySearchResult[]> {
    try {
      const extractOptions: any = {
        includeImages: opts?.includeImages || false,
        extractDepth: opts?.extractDepth || 'basic',
      };

      const response = await this.client.extract(urls, extractOptions);

      return response.results.map((result: any) => ({
        title: 'Extracted Content',
        url: result.url,
        content: result.rawContent || result.raw_content,
        rawContent: result.rawContent || result.raw_content,
      }));
    } catch (error) {
      console.error(`Tavily extract failed:`, error);
      throw new Error(`Failed to extract with Tavily: ${error}`);
    }
  }

  private logSearchActivity(query: string, resultCount: number): void {
    console.log(`[Tavily] Searched for "${query}" with ${resultCount} results`);
  }
}
