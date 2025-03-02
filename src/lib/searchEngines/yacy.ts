import axios from 'axios';
import { getYacyJsonEndpoint } from '../../config';

interface YaCySearchResult {
  channels: {
    title: string;
    description: string;
    link: string;
    image: {
      url: string;
      title: string;
      link: string;
    };
    startIndex: string;
    itemsPerPage: string;
    searchTerms: string;
    items: {
      title: string;
      link: string;
      code: string;
      description: string;
      pubDate: string;
      image?: string;
      size: string;
      sizename: string;
      guid: string;
      faviconUrl: string;
      host: string;
      path: string;
      file: string;
      urlhash: string;
      ranking: string;
    }[];
    navigation: {
      facetname: string;
      displayname: string;
      type: string;
      min: string;
      max: string;
      mean: string;
      elements: {
        name: string;
        count: string;
        modifier: string;
        url: string;
      }[];
    }[];
  }[];
}

export const searchYaCy = async (query: string, numResults: number = 20) => {
  try {
    const yacyBaseUrl = getYacyJsonEndpoint();

    const url = new URL(`${yacyBaseUrl}/yacysearch.json`);
    url.searchParams.append('query', query);
    url.searchParams.append('count', numResults.toString());

    const res = await axios.get(url.toString());

    const originalres = res.data as YaCySearchResult;

    const results = originalres.channels[0].items.map((item) => ({
      title: item.title,
      url: item.link,
      content: item.description,
      img_src: item.image || null,
      pubDate: item.pubDate,
      host: item.host,
    }));

    return { results, originalres };
  } catch (error) {
    const errorMessage = error.response?.data
      ? JSON.stringify(error.response.data, null, 2)
      : error.message || 'Unknown error';
    throw new Error(`YaCy Error: ${errorMessage}`);
  }
};
