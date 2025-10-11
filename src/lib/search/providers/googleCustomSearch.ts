import axios from 'axios';
import {
  getGoogleCustomSearchApiKey,
  getGoogleCustomSearchCx,
} from '../../config';
import type {
  SearchProvider,
  SearchOptions,
  SearchResponse,
  SearchResult,
} from './types';

/**
 * Google Custom Search Engine provider implementation
 * Docs: https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list
 */
export class GoogleCustomSearchProvider implements SearchProvider {
  async search(query: string, opts?: SearchOptions): Promise<SearchResponse> {
    const apiKey = getGoogleCustomSearchApiKey();
    const cx = getGoogleCustomSearchCx();

    if (!apiKey || !cx) {
      throw new Error(
        'Google Custom Search API key and CX (Search Engine ID) are required',
      );
    }

    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.append('key', apiKey);
    url.searchParams.append('cx', cx);
    url.searchParams.append('q', query);

    // Map options to Google Custom Search parameters
    if (opts?.language) {
      url.searchParams.append('lr', `lang_${opts.language}`);
    }

    if (opts?.pageno && opts.pageno > 1) {
      // Google CSE uses start index (1-indexed, 10 results per page)
      const startIndex = (opts.pageno - 1) * 10 + 1;
      url.searchParams.append('start', startIndex.toString());
    }

    // Handle search type based on engines
    if (opts?.engines) {
      if (
        opts.engines.some((e) => e.toLowerCase().includes('image')) ||
        opts.engines.some((e) => e.toLowerCase().includes('google images'))
      ) {
        url.searchParams.append('searchType', 'image');
      }
    }

    try {
      const res = await axios.get(url.toString());

      const items = res.data.items || [];
      const results: SearchResult[] = items.map((item: any) => {
        // Handle image results
        if (item.image) {
          return {
            title: item.title || '',
            url: item.image.contextLink || item.link || '',
            img_src: item.link || '', // For images, link is the image URL
            thumbnail_src: item.image.thumbnailLink || '',
            content: item.snippet || '',
          };
        }

        // Handle regular web results
        return {
          title: item.title || '',
          url: item.link || '',
          content: item.snippet || '',
          // Google CSE doesn't provide thumbnails for regular results
        };
      });

      // Google Custom Search doesn't provide suggestions in the same API call
      // You would need a separate Autocomplete API call for suggestions
      const suggestions: string[] = [];

      return { results, suggestions };
    } catch (error: any) {
      if (error.response?.status === 429) {
        throw new Error(
          'Google Custom Search API quota exceeded. Check your API limits.',
        );
      }
      throw new Error(
        `Google Custom Search API error: ${error.message || 'Unknown error'}`,
      );
    }
  }
}
