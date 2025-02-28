import axios from 'axios';
import { getBingSubscriptionKey } from '../../config';

interface BingAPISearchResult {
  _type: string;
  name: string;
  url: string;
  displayUrl: string;
  snippet?: string;
  dateLastCrawled?: string;
  thumbnailUrl?: string;
  contentUrl?: string;
  hostPageUrl?: string;
  width?: number;
  height?: number;
  accentColor?: string;
  contentSize?: string;
  datePublished?: string;
  encodingFormat?: string;
  hostPageDisplayUrl?: string;
  id?: string;
  isLicensed?: boolean;
  isFamilyFriendly?: boolean;
  language?: string;
  mediaUrl?: string;
  motionThumbnailUrl?: string;
  publisher?: string;
  viewCount?: number;
  webSearchUrl?: string;
  primaryImageOfPage?: {
    thumbnailUrl?: string;
    width?: number;
    height?: number;
  };
  video?: {
    allowHttpsEmbed?: boolean;
    embedHtml?: string;
    allowMobileEmbed?: boolean;
    viewCount?: number;
    duration?: string;
  };
  image?: {
    thumbnail?: {
      contentUrl?: string;
      width?: number;
      height?: number;
    };
    imageInsightsToken?: string;
    imageId?: string;
  };
}

export const searchBingAPI = async (query: string) => {
  try {
    const bingApiKey = await getBingSubscriptionKey();
    const url = new URL(`https://api.cognitive.microsoft.com/bing/v7.0/search`);
    url.searchParams.append('q', query);
    url.searchParams.append('responseFilter', 'Webpages,Images,Videos');

    const res = await axios.get(url.toString(), {
      headers: {
        'Ocp-Apim-Subscription-Key': bingApiKey,
        'Accept': 'application/json'
      }
    });

    if (res.data.error) {
      throw new Error(`Bing API Error: ${res.data.error.message}`);
    }

    const originalres = res.data;

    // Extract web, image, and video results
    const webResults = originalres.webPages?.value || [];
    const imageResults = originalres.images?.value || [];
    const videoResults = originalres.videos?.value || [];

    const results = webResults.map((item: BingAPISearchResult) => ({
      title: item.name,
      url: item.url,
      content: item.snippet,
      img_src: item.primaryImageOfPage?.thumbnailUrl
             || imageResults.find((img: any) => img.hostPageUrl === item.url)?.thumbnailUrl
             || videoResults.find((vid: any) => vid.hostPageUrl === item.url)?.thumbnailUrl,
      ...(item.video && {
        videoData: {
          duration: item.video.duration,
          embedUrl: item.video.embedHtml?.match(/src="(.*?)"/)?.[1]
        },
      publisher: item.publisher,
      datePublished: item.datePublished
      })
    }));

    return { results, originalres };
  } catch (error) {
    const errorMessage = error.response?.data
      ? JSON.stringify(error.response.data, null, 2)
      : error.message || 'Unknown error';
    throw new Error(`Bing API Error: ${errorMessage}`);
  }
};