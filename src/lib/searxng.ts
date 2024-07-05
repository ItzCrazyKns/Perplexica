import axios from "axios";
import { getSearxngApiEndpoint } from "../config";

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
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
}

export const searchSearxng = async (query: string, options?: SearxngSearchOptions) => {
  const searxngURL = getSearxngApiEndpoint();

  const url = new URL(`${searxngURL}/search?format=json`);
  url.searchParams.append("q", query);

  if (options) {
    for (const key of Object.keys(options)) {
      if (Array.isArray(options[key])) {
        url.searchParams.append(key, options[key].join(","));
        continue;
      }
      url.searchParams.append(key, options[key]);
    }
  }

  const res = await axios.get(url.toString());

  const results: SearxngSearchResult[] = res.data.results;
  const suggestions: string[] = res.data.suggestions;

  return { results, suggestions };
};
