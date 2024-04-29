import axios from 'axios';
import { getSearxngApiEndpoint } from '../config';
import {SearchOptions, SearchResult} from "./search";

export const searchSearxng = async (
  query: string,
  opts?: SearchOptions,
) => {
  const searxngURL = getSearxngApiEndpoint();

  const url = new URL(`${searxngURL}/search?format=json`);
  url.searchParams.append('q', query);

  if (opts) {
    Object.keys(opts).forEach((key) => {
      if (Array.isArray(opts[key])) {
        url.searchParams.append(key, opts[key].join(','));
        return;
      }
      url.searchParams.append(key, opts[key]);
    });
  }

  const res = await axios.get(url.toString());

  const results: SearchResult[] = res.data.results;
  const suggestions: string[] = res.data.suggestions;

  return { results, suggestions };
};
