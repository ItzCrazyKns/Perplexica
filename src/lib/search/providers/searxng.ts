import axios from 'axios';
import { getSearxngApiEndpoint } from '../../config';
import type {
  SearchProvider,
  SearchOptions,
  SearchResponse,
} from './types';

/**
 * SearxNG search provider implementation
 */
export class SearxngProvider implements SearchProvider {
  async search(query: string, opts?: SearchOptions): Promise<SearchResponse> {
    const searxngURL = getSearxngApiEndpoint();

    const url = new URL(`${searxngURL}/search?format=json`);
    url.searchParams.append('q', query);

    if (opts) {
      Object.keys(opts).forEach((key) => {
        const value = opts[key as keyof SearchOptions];
        if (Array.isArray(value)) {
          url.searchParams.append(key, value.join(','));
          return;
        }
        url.searchParams.append(key, value as string);
      });
    }

    const res = await axios.get(url.toString());

    const results = res.data.results || [];
    const suggestions = res.data.suggestions || [];

    return { results, suggestions };
  }
}
