import axios from 'axios';
import { getSearxngApiEndpoint } from '../config';

interface SearxngSearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
}

interface SearxngSearchResult {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  content?: string;
  author?: string;
}

export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  try {
    const searxngURL = getSearxngApiEndpoint();
    console.log('Searxng API endpoint:', searxngURL);

    const url = new URL(`${searxngURL}/search?format=json`);
    url.searchParams.append('q', query);
    console.log('Initial URL with query:', url.toString());

    if (opts) {
      Object.keys(opts).forEach((key) => {
        if (Array.isArray(opts[key])) {
          url.searchParams.append(key, opts[key].join(','));
        } else {
          url.searchParams.append(key, opts[key]);
        }
        console.log(`Added search option ${key}:`, opts[key]);
      });
    }

    console.log('Final URL with all parameters:', url.toString());
    const res = await axios.get(url.toString());
    console.log('API response received');

    const results: SearxngSearchResult[] = res.data.results;
    const suggestions: string[] = res.data.suggestions;
    console.log('Results and suggestions extracted from the response');

    return { results, suggestions };
  } catch (error) {
    console.error('Error during Searxng search:', error);
    throw error; // Re-throw the error after logging it
  }
};
