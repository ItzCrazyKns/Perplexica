import { getSearxngApiEndpoint } from '@/lib/config';
import {
  SearchProvider,
  SearchProviderNames,
  SearchResult,
  SearxngSearchOptions,
} from '../types';
import axios from 'axios';

export class SearxngProvider implements SearchProvider {
  private searxngURL: string;

  constructor(apiEndpoint?: string) {
    this.searxngURL = apiEndpoint || getSearxngApiEndpoint();
    if (!this.searxngURL) {
      throw new Error('Searxng API endpoint is not configured');
    }
  }

  private buildSearchURL(query: string, opts?: SearxngSearchOptions): URL {
    const url = new URL(`${this.searxngURL}/search?format=json`);
    url.searchParams.append('q', query);

    if (opts) {
      if (opts.count) {
        url.searchParams.append('limit', String(opts.count));
      }

      Object.keys(opts).forEach((key) => {
        if (key === 'count') return; // Already handled

        const value = opts[key as keyof SearxngSearchOptions];
        if (Array.isArray(value)) {
          url.searchParams.append(key, value.join(','));
          return;
        }
        url.searchParams.append(key, value as string);
      });
    }

    return url;
  }

  private parseSearchResponse(response: any): SearchResult[] {
    return response.results.map((result: any) => ({
      title: result.title,
      url: result.url,
      img_src: result.img_src,
      thumbnail_src: result.thumbnail_src,
      thumbnail: result.thumbnail,
      content: result.content,
      author: result.author,
      iframe_src: result.iframe_src,
    }));
  }

  async search(
    query: string,
    opts?: SearxngSearchOptions,
  ): Promise<SearchResult[]> {
    const url = this.buildSearchURL(query, opts);

    try {
      const res = await axios.get(url.toString());
      const { results, suggestions } = res.data;

      this.logSearchActivity(query, results.length);

      return this.parseSearchResponse({ results, suggestions });
    } catch (error) {
      console.error(`Searxng search failed:`, error);
      throw new Error(`Failed to search with Searxng: ${error}`);
    }
  }

  getName(): SearchProviderNames {
    return 'searxng';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const url = new URL(`${this.searxngURL}/search`);
      url.searchParams.append('q', 'test');
      const res = await axios.get(url.toString());
      return res.status === 200;
    } catch {
      return false;
    }
  }

  private logSearchActivity(query: string, resultCount: number): void {
    console.log(
      `[Searxng] Searched for "${query}" with ${resultCount} results`,
    );
  }

  // searxng specific method
  async getSuggestions(query: string): Promise<string[]> {
    const url = this.buildSearchURL(query);
    try {
      const res = await axios.get(url.toString());
      return res.data.suggestions || [];
    } catch (error) {
      console.error(`Searxng suggestions failed:`, error);
      return [];
    }
  }
}
