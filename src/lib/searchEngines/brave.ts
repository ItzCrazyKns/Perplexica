import axios from 'axios';
import { getBraveApiKey } from '../../config';

interface BraveSearchResult {
  title: string;
  url: string;
  content?: string;
  img_src?: string;
  age?: string;
  family_friendly?: boolean;
  language?: string;
  video?: {
    embedUrl?: string;
    duration?: string;
  };
  rating?: {
    value: number;
    scale: number;
  };
  products?: Array<{
    name: string;
    price?: string;
  }>;
  recipe?: {
    ingredients?: string[];
    cookTime?: string;
  };
  meta?: {
    fetched?: string;
    lastCrawled?: string;
  };
}

export const searchBraveAPI = async (
  query: string,
  numResults: number = 20
): Promise<{ results: BraveSearchResult[]; originalres: any }> => {
  try {
    const braveApiKey = await getBraveApiKey();
    const url = new URL(`https://api.search.brave.com/res/v1/web/search`);

    url.searchParams.append('q', query);
    url.searchParams.append('count', numResults.toString());

    const res = await axios.get(url.toString(), {
      headers: {
        'X-Subscription-Token': braveApiKey,
        'Accept': 'application/json'
      }
    });

    if (res.data.error) {
      throw new Error(`Brave API Error: ${res.data.error.message}`);
    }

    const originalres = res.data;
    const webResults = originalres.web?.results || [];

    const results: BraveSearchResult[] = webResults.map((item: any) => ({
      title: item.title,
      url: item.url,
      content: item.description,
      img_src: item.thumbnail?.src || item.deep_results?.images?.[0]?.src,
      age: item.age,
      family_friendly: item.family_friendly,
      language: item.language,
      video: item.video ? {
        embedUrl: item.video.embed_url,
        duration: item.video.duration
      } : undefined,
      rating: item.rating ? {
        value: item.rating.value,
        scale: item.rating.scale_max
      } : undefined,
      products: item.deep_results?.product_cluster?.map((p: any) => ({
        name: p.name,
        price: p.price
      })),
      recipe: item.recipe ? {
        ingredients: item.recipe.ingredients,
        cookTime: item.recipe.cook_time
      } : undefined,
      meta: {
        fetched: item.meta?.fetched,
        lastCrawled: item.meta?.last_crawled
      }
    }));

    return { results, originalres };
  } catch (error) {
    const errorMessage = error.response?.data
      ? JSON.stringify(error.response.data, null, 2)
      : error.message || 'Unknown error';
    throw new Error(`Brave API Error: ${errorMessage}`);
  }
};
