import express from 'express';
import { searchSearxng } from '../lib/searchEngines/searxng';
import { searchGooglePSE } from '../lib/searchEngines/google_pse';
import { getSearchEngineBackend } from '../config';
import logger from '../utils/logger';

const router = express.Router();

const searchEngine = getSearchEngineBackend();

async function performSearch(query: string, site: string, searchEngine: string) {
  switch (searchEngine) {
    case 'google': {
      const googleResult = await searchGooglePSE(query);

      return googleResult.originalres.map(item => {
        const imageSources = [
          item.pagemap?.cse_image?.[0]?.src,
          item.pagemap?.cse_thumbnail?.[0]?.src,
          item.pagemap?.metatags?.[0]?.['og:image'],
          item.pagemap?.metatags?.[0]?.['twitter:image'],
          item.pagemap?.metatags?.[0]?.['image'],
        ].filter(Boolean); // Remove undefined values

        return {
          title: item.title,
          url: item.link,
          content: item.snippet,
          thumbnail: imageSources[0], // First available image
          img_src: imageSources[0],   // Same as thumbnail for consistency
          iframe_src: null,
          author: item.pagemap?.metatags?.[0]?.['og:site_name'] || site,
          publishedDate: item.pagemap?.metatags?.[0]?.['article:published_time']
        };
      });
    }

    case 'searxng': {
      const searxResult = await searchSearxng(query, {
        engines: ['bing news'],
        pageno: 1,
      });
      return searxResult.results;
    }

    default:
      throw new Error(`Unknown search engine ${searchEngine}`);
  }
}


router.get('/', async (req, res) => {
  try {
    const queries = [
      { site: 'businessinsider.com', topic: 'AI' },
      { site: 'www.exchangewire.com', topic: 'AI' },
      { site: 'yahoo.com', topic: 'AI' },
      { site: 'businessinsider.com', topic: 'tech' },
      { site: 'www.exchangewire.com', topic: 'tech' },
      { site: 'yahoo.com', topic: 'tech' },
    ];

    const data = (
      await Promise.all(
        queries.map(async ({ site, topic }) => {
          try {
            const query = `site:${site} ${topic}`;
            return await performSearch(query, site, searchEngine);
          } catch (error) {
            logger.error(`Error searching ${site}: ${error.message}`);
            return [];
          }
        })
      )
    )
      .flat()
      .sort(() => Math.random() - 0.5)
      .filter(item => item.title && item.url && item.content);

    return res.json({ blogs: data });
  } catch (err: any) {
    logger.error(`Error in discover route: ${err.message}`);
    return res.status(500).json({ message: 'An error has occurred' });
  }
});

export default router;
