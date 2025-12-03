import { SearxngSearchOptions, SearxngSearchResult } from './searxng';

interface SearchCorpusRequest {
  query: string;
  n_results?: number;
}

interface SearchCorpusResponse {
  results: SearxngSearchResult[];
  suggestions: string[];
}

export const searchLocalCorpus = async (
  query: string,
  opts?: SearxngSearchOptions,
): Promise<{ results: SearxngSearchResult[]; suggestions: string[] }> => {
  const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL;

  const response = await fetch(`${AGENT_SERVICE_URL}/search_corpus/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      n_results: 30,
    } as SearchCorpusRequest),
  });

  if (!response.ok) {
    throw new Error(`Corpus search failed: ${response.status}`);
  }

  const data = await response.json();

  const results: SearxngSearchResult[] = data.results;
  const suggestions: string[] = data.suggestions;

  return { results, suggestions };
};
