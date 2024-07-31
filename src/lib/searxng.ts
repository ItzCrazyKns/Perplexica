import { getSearxngApiEndpoint } from '../config';

import { SearxngService, type SearxngSearchParameters } from 'searxng';

const searxng = new SearxngService({
  baseURL: getSearxngApiEndpoint(),
  defaultSearchParams: {
    format: 'json'
  }
})

export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchParameters,
) => {

  const { results, suggestions } = await searxng.search(query, opts);
  return { results, suggestions };
};
