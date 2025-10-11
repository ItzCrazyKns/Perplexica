import { getFirecrawlApiKey } from '@/lib/config';
import {
  SearchProvider,
  SearchResult,
  FirecrawlSearchOptions,
  SearchProviderNames,
} from '../types';
import Firecrawl from '@mendable/firecrawl-js';

export interface FirecrawlCrawlOptions {
  limit?: number;
  maxDepth?: number;
  allowBackwardLinks?: boolean;
  allowExternalLinks?: boolean;
  scrapeOptions?: FirecrawlSearchOptions;
}

export class FirecrawlProvider implements SearchProvider {
  private client: any;

  constructor(apiKey?: string) {
    const currentApiKey = apiKey || getFirecrawlApiKey();
    if (!currentApiKey) {
      throw new Error('Firecrawl API key is required');
    }
    this.client = new Firecrawl({ apiKey: currentApiKey });
  }

  async search(
    query: string,
    opts?: FirecrawlSearchOptions,
  ): Promise<SearchResult[]> {
    try {
      const searchOptions: any = {
        formats: opts?.formats || ['markdown'],
        onlyMainContent: opts?.onlyMainContent !== false,
      };

      if (opts?.timeout) {
        searchOptions.timeout = opts.timeout;
      }

      if (opts?.waitFor) {
        searchOptions.waitFor = opts.waitFor;
      }

      // Firecrawl uses the search method to search the internet
      const response = await this.client.search(query, searchOptions);

      this.logSearchActivity(query, response.web?.length || 0);

      return (response.web || []).map((result: any) => ({
        title: result?.title || 'No title',
        url: result.url,
        content: result.markdown || result.html || result.rawHtml,
      }));
    } catch (error) {
      console.error(`Firecrawl search failed:`, error);
      throw new Error(`Failed to search with Firecrawl: ${error}`);
    }
  }

  getName(): SearchProviderNames {
    return 'firecrawl';
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check availability by scraping one page
      await this.scrapeUrl('https://example.com');
      return true;
    } catch {
      return false;
    }
  }

  // Method for scraping a single URL
  async scrapeUrl(
    url: string,
    opts?: FirecrawlSearchOptions,
  ): Promise<SearchResult> {
    try {
      const scrapeOptions: any = {
        formats: opts?.formats || ['markdown'],
        onlyMainContent: opts?.onlyMainContent !== false,
      };

      if (opts?.timeout) {
        scrapeOptions.timeout = opts.timeout;
      }

      if (opts?.waitFor) {
        scrapeOptions.waitFor = opts.waitFor;
      }

      const response = await this.client.scrapeUrl(url, scrapeOptions);

      return {
        title: response?.title || 'No title',
        url: response?.url || url,
        content: response.markdown || response.html || response.rawHtml,
      };
    } catch (error) {
      console.error(`Firecrawl scrape failed:`, error);
      throw new Error(`Failed to scrape with Firecrawl: ${error}`);
    }
  }

  // Method for crawling a site
  async crawlUrl(
    url: string,
    opts?: FirecrawlCrawlOptions,
  ): Promise<SearchResult[]> {
    try {
      const crawlOptions: any = {
        limit: opts?.limit || 100,
        scrapeOptions: {
          formats: opts?.scrapeOptions?.formats || ['markdown'],
          onlyMainContent: opts?.scrapeOptions?.onlyMainContent !== false,
        },
      };

      if (opts?.maxDepth) {
        crawlOptions.maxDepth = opts.maxDepth;
      }

      if (opts?.allowBackwardLinks !== undefined) {
        crawlOptions.allowBackwardLinks = opts.allowBackwardLinks;
      }

      if (opts?.allowExternalLinks !== undefined) {
        crawlOptions.allowExternalLinks = opts.allowExternalLinks;
      }

      const response = await this.client.crawlUrl(url, crawlOptions);

      // Waiting for the crawl to complete
      let crawlStatus = await this.client.checkCrawlStatus(response.id);

      while (crawlStatus.status === 'scraping') {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        crawlStatus = await this.client.checkCrawlStatus(response.id);
      }

      if (crawlStatus.status === 'completed') {
        return (crawlStatus.data || []).map((result: any) => ({
          title: result?.title || 'No title',
          url: result.url,
          content: result.markdown || result.html || result.rawHtml,
        }));
      }

      throw new Error(`Crawl failed with status: ${crawlStatus.status}`);
    } catch (error) {
      console.error(`Firecrawl crawl failed:`, error);
      throw new Error(`Failed to crawl with Firecrawl: ${error}`);
    }
  }

  // Method for getting a sitemap
  async mapUrl(url: string): Promise<string[]> {
    try {
      const response = await this.client.mapUrl(url);
      return response.links || [];
    } catch (error) {
      console.error(`Firecrawl map failed:`, error);
      throw new Error(`Failed to map with Firecrawl: ${error}`);
    }
  }

  private logSearchActivity(query: string, resultCount: number): void {
    console.log(
      `[Firecrawl] Searched for "${query}" with ${resultCount} results`,
    );
  }
}
