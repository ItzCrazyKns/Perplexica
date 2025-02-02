import express from 'express';
import { searchSearxng } from '../lib/searxng';
import logger from '../utils/logger';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Example: Searching UAE-based news sites for "AI" & "Tech"
    const data = (
      await Promise.all([
        // Gulf News
        searchSearxng('site:gulfnews.com AI', {
          engines: ['bing news'],
          pageno: 1,
        }),
        searchSearxng('site:gulfnews.com Tech', {
          engines: ['bing news'],
          pageno: 1,
        }),

        // Khaleej Times
        searchSearxng('site:khaleejtimes.com AI', {
          engines: ['bing news'],
          pageno: 1,
        }),
        searchSearxng('site:khaleejtimes.com Tech', {
          engines: ['bing news'],
          pageno: 1,
        }),

        // The National
        searchSearxng('site:thenationalnews.com AI', {
          engines: ['bing news'],
          pageno: 1,
        }),
        searchSearxng('site:thenationalnews.com Tech', {
          engines: ['bing news'],
          pageno: 1,
        }),

        // Arabian Business
        searchSearxng('site:arabianbusiness.com AI', {
          engines: ['bing news'],
          pageno: 1,
        }),
        searchSearxng('site:arabianbusiness.com Tech', {
          engines: ['bing news'],
          pageno: 1,
        }),
      ])
    )
      .map((result) => result.results)
      .flat()
      // Randomize the order
      .sort(() => Math.random() - 0.5);

    return res.json({ blogs: data });
  } catch (err: any) {
    logger.error(`Error in discover route: ${err.message}`);
    return res.status(500).json({ message: 'An error has occurred' });
  }
});

export default router;
