import axios from 'axios';
import { getGoogleApiKey, getGoogleCseId } from '../../config';

interface GooglePSESearchResult {
  kind: string;
  title: string;
  htmlTitle: string;
  link: string;
  displayLink: string;
  snippet?: string;
  htmlSnippet?: string;
  cacheId?: string;
  formattedUrl: string;
  htmlFormattedUrl: string;
  pagemap?: {
    videoobject: any;
    cse_thumbnail?: Array<{
      src: string;
      width: string;
      height: string;
    }>;
    metatags?: Array<{
      [key: string]: string;
      author?: string;
    }>;
    cse_image?: Array<{
      src: string;
    }>;
  };
  fileFormat?: string;
  image?: {
    contextLink: string;
    thumbnailLink: string;
  };
  mime?: string;
  labels?: Array<{
    name: string;
    displayName: string;
  }>;
}

export const searchGooglePSE = async (query: string) => {
  try {
    const [googleApiKey, googleCseID] = await Promise.all([
      getGoogleApiKey(),
      getGoogleCseId(),
    ]);

    const url = new URL(`https://www.googleapis.com/customsearch/v1`);
    url.searchParams.append('q', query);
    url.searchParams.append('cx', googleCseID);
    url.searchParams.append('key', googleApiKey);

    const res = await axios.get(url.toString());

    if (res.data.error) {
      throw new Error(`Google PSE Error: ${res.data.error.message}`);
    }

    const originalres = res.data.items;

    const results = originalres.map((item: GooglePSESearchResult) => ({
      title: item.title,
      url: item.link,
      content: item.snippet,
      img_src:
        item.pagemap?.cse_image?.[0]?.src ||
        item.pagemap?.cse_thumbnail?.[0]?.src ||
        item.image?.thumbnailLink,
      ...(item.pagemap?.videoobject?.[0] && {
        videoData: {
          duration: item.pagemap.videoobject[0].duration,
          embedUrl: item.pagemap.videoobject[0].embedurl,
        },
      }),
    }));

    return { results, originalres };
  } catch (error) {
    const errorMessage = error.response?.data
      ? JSON.stringify(error.response.data, null, 2)
      : error.message || 'Unknown error';
    throw new Error(`Google PSE Error: ${errorMessage}`);
  }
};
