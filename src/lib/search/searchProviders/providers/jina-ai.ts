import { getJinaApiKey } from '@/lib/config';
import { SearchProvider, SearchResult, SearchOptions } from '../types';
import axios from 'axios';

export interface JinaSearchOptions extends SearchOptions {
  noCache?: boolean;
  gatherImages?: boolean;
  gatherLinks?: boolean;
}

export class JinaAIProvider implements SearchProvider {
  private apiKey: string;
  private readerBaseUrl = 'https://r.jina.ai';
  private searchBaseUrl = 'https://s.jina.ai';

  constructor(apiKey?: string) {
    const currentApiKey = apiKey || getJinaApiKey();
    if (!currentApiKey) {
      throw new Error('Jina AI API key is required');
    }
    this.apiKey = currentApiKey;
  }

  private getHeaders(opts?: JinaSearchOptions): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
    };

    if (opts?.noCache) {
      headers['X-No-Cache'] = 'true';
    }

    if (opts?.gatherImages) {
      headers['X-With-Generated-Alt'] = 'true';
      headers['X-With-Images-Summary'] = 'true';
    }

    if (opts?.gatherLinks) {
      headers['X-With-Links-Summary'] = 'true';
    }

    return headers;
  }

  async search(
    query: string,
    opts?: JinaSearchOptions,
  ): Promise<SearchResult[]> {
    try {
      const url = `${this.searchBaseUrl}/${encodeURIComponent(query)}`;
      const headers = this.getHeaders(opts);

      const response = await axios.get(url, { headers });
      const data: {
        title: string;
        url: string;
        description: string;
        date: string;
        content: string;
        metadata: Record<string, string>;
        external: Record<string, any>;
        usage: { tokens: number };
      }[] = response.data.data;

      this.logSearchActivity(query, 1);

      return data.map((result: any) => ({
        title: result.title,
        url: result.url,
        content: result.content,
      }));
    } catch (error) {
      console.error(`Jina AI search failed:`, error);
      throw new Error(`Failed to search with Jina AI: ${error}`);
    }
  }

  getName(): string {
    return 'jina-ai';
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.readUrl('https://example.com');
      return true;
    } catch {
      return false;
    }
  }

  // Method for reading URLs and converting to markdown
  async readUrl(url: string, opts?: JinaSearchOptions): Promise<SearchResult> {
    try {
      const jinaUrl = `${this.readerBaseUrl}/${encodeURIComponent(url)}`;
      const headers = this.getHeaders(opts);

      const response = await axios.get(jinaUrl, { headers });
      const data = response.data.data;
      console.log('data2', data);

      // Jina Reader returns markdown content
      const content =
        typeof response.data === 'string'
          ? response.data
          : response.data.data || JSON.stringify(response.data);

      return {
        title: `Content from: ${url}`,
        url: url,
        content: content,
      };
    } catch (error) {
      console.error(`Jina AI read failed:`, error);
      throw new Error(`Failed to read with Jina AI: ${error}`);
    }
  }

  // Method for reading multiple URLs
  async readUrls(
    urls: string[],
    opts?: JinaSearchOptions,
  ): Promise<SearchResult[]> {
    try {
      const results = await Promise.all(
        urls.map((url) => this.readUrl(url, opts)),
      );
      return results;
    } catch (error) {
      console.error(`Jina AI bulk read failed:`, error);
      throw new Error(`Failed to read multiple URLs with Jina AI: ${error}`);
    }
  }

  private logSearchActivity(query: string, resultCount: number): void {
    console.log(
      `[Jina AI] Searched for "${query}" with ${resultCount} results`,
    );
  }
}
