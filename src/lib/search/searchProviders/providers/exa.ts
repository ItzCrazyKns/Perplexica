import { getExaApiKey } from '@/lib/config';
import {
  SearchProvider,
  SearchResult,
  ExaSearchOptions,
  SearchProviderNames,
} from '../types';
import Exa from 'exa-js';

export interface ExaSearchResult extends SearchResult {
  score?: number;
  author?: string;
  publishedDate?: string;
  highlights?: {
    title?: string;
    url?: string;
    text?: string;
  };
}

export class ExaProvider implements SearchProvider {
  private client: Exa;

  constructor(apiKey?: string) {
    const currentApiKey = apiKey || getExaApiKey();
    if (!currentApiKey) {
      throw new Error('Exa API key is required');
    }
    this.client = new Exa(currentApiKey);
  }

  async search(
    query: string,
    opts?: ExaSearchOptions,
  ): Promise<ExaSearchResult[]> {
    try {
      const searchOptions: any = {
        numResults: opts?.count || 10, // Use common count option
        startCrawlDate: opts?.startCrawlDate,
        endCrawlDate: opts?.endCrawlDate,
      };

      // Determine if we need to get content
      const needsContents =
        opts?.textContentsOnly ||
        opts?.summary ||
        opts?.highlightTitle ||
        opts?.highlightUrl ||
        opts?.highlightText;

      let response;

      if (needsContents) {
        // Use searchAndContents to get content
        const contentOptions: any = {
          ...searchOptions,
        };

        if (opts?.textContentsOnly) {
          contentOptions.text = true;
        }

        if (opts?.summary) {
          contentOptions.summary = opts.summary;
        }

        if (opts?.highlightTitle || opts?.highlightUrl || opts?.highlightText) {
          contentOptions.highlights = true;
        }

        response = await this.client.searchAndContents(query, contentOptions);
      } else {
        // Use regular search
        response = await this.client.search(query, searchOptions);
      }

      return response.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        score: result.score,
        content: result.text,
        author: result.author,
        publishedDate: result.publishedDate,
        highlights: result.highlights
          ? {
              title: result.highlights.title,
              url: result.highlights.url,
              text: result.highlights.text,
            }
          : undefined,
      }));
    } catch (error) {
      console.error(`Exa search failed:`, error);
      throw new Error(`Failed to search with Exa: ${error}`);
    }
  }

  getName(): SearchProviderNames {
    return 'exa';
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.search('test', { numResults: 1 });
      return true;
    } catch {
      return false;
    }
  }

  // Method to get content by URL
  async searchByURLs(
    urls: string[],
    opts?: { summarize?: boolean; highlights?: boolean },
  ): Promise<ExaSearchResult[]> {
    try {
      const contentOptions: any = {};

      if (opts?.summarize) {
        contentOptions.summary = true;
      }

      if (opts?.highlights) {
        contentOptions.highlights = true;
      } else {
        contentOptions.text = true;
      }

      const response = await this.client.getContents(urls, contentOptions);

      return response.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        score: 1.0,
        content: result.text,
        author: result.author,
        publishedDate: result.publishedDate,
      }));
    } catch (error) {
      console.error(`Exa content search failed:`, error);
      throw new Error(`Failed to search content with Exa: ${error}`);
    }
  }

  // Method to get content by ID (URL)
  async getContentById(exaId: string): Promise<ExaSearchResult | null> {
    try {
      const response = await this.client.getContents([exaId], { text: true });

      if (response.results.length === 0) {
        return null;
      }

      const result = response.results[0];

      return {
        title: result.title || 'No title',
        url: result.url,
        score: 1.0,
        content: result.text,
        author: result.author,
        publishedDate: result.publishedDate,
      };
    } catch (error) {
      console.error(`Exa content by ID failed:`, error);
      return null;
    }
  }

  private logSearchActivity(query: string, resultCount: number): void {
    console.log(`[Exa] Searched for "${query}" with ${resultCount} results`);
  }
}
