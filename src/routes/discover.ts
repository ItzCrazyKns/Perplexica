import express from 'express';
import { searchSearxng } from '../lib/searxng';
import logger from '../utils/logger';
import db from '../db';
import { userPreferences } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Helper function to get search queries for a category
const getSearchQueriesForCategory = (category: string): { site: string, keyword: string }[] => {
  const categories: Record<string, { site: string, keyword: string }[]> = {
    'Technology': [
      { site: 'techcrunch.com', keyword: 'tech' },
      { site: 'wired.com', keyword: 'technology' },
      { site: 'theverge.com', keyword: 'tech' }
    ],
    'AI': [
      { site: 'businessinsider.com', keyword: 'AI' },
      { site: 'www.exchangewire.com', keyword: 'AI' },
      { site: 'yahoo.com', keyword: 'AI' }
    ],
    'Sports': [
      { site: 'espn.com', keyword: 'sports' },
      { site: 'sports.yahoo.com', keyword: 'sports' },
      { site: 'bleacherreport.com', keyword: 'sports' }
    ],
    'Money': [
      { site: 'bloomberg.com', keyword: 'finance' },
      { site: 'cnbc.com', keyword: 'money' },
      { site: 'wsj.com', keyword: 'finance' }
    ],
    'Gaming': [
      { site: 'ign.com', keyword: 'games' },
      { site: 'gamespot.com', keyword: 'gaming' },
      { site: 'polygon.com', keyword: 'games' }
    ],
    'Weather': [
      { site: 'weather.com', keyword: 'forecast' },
      { site: 'accuweather.com', keyword: 'weather' },
      { site: 'wunderground.com', keyword: 'weather' }
    ],
    'Entertainment': [
      { site: 'variety.com', keyword: 'entertainment' },
      { site: 'hollywoodreporter.com', keyword: 'entertainment' },
      { site: 'ew.com', keyword: 'entertainment' }
    ],
    'Science': [
      { site: 'scientificamerican.com', keyword: 'science' },
      { site: 'nature.com', keyword: 'science' },
      { site: 'science.org', keyword: 'science' }
    ],
    'Health': [
      { site: 'webmd.com', keyword: 'health' },
      { site: 'health.harvard.edu', keyword: 'health' },
      { site: 'mayoclinic.org', keyword: 'health' }
    ],
    'Travel': [
      { site: 'travelandleisure.com', keyword: 'travel' },
      { site: 'lonelyplanet.com', keyword: 'travel' },
      { site: 'tripadvisor.com', keyword: 'travel' }
    ],
    'Current News': [
      { site: 'reuters.com', keyword: 'news' },
      { site: 'apnews.com', keyword: 'news' },
      { site: 'bbc.com', keyword: 'news' }
    ]
  };
  
  return categories[category] || categories['Technology'];
};

// Helper function to perform searches for a category
const searchCategory = async (category: string) => {
  const queries = getSearchQueriesForCategory(category);
  const searchPromises = queries.map(query => 
    searchSearxng(`site:${query.site} ${query.keyword}`, {
      engines: ['bing news'],
      pageno: 1,
    })
  );
  
  const results = await Promise.all(searchPromises);
  return results.map(result => result.results).flat();
};

// Main discover route - supports category and preferences parameters
router.get('/', async (req, res) => {
  try {
    const category = req.query.category as string;
    const preferencesParam = req.query.preferences as string;
    
    let data: any[] = [];
    
    if (category && category !== 'For You') {
      // Get news for a specific category
      data = await searchCategory(category);
    } else if (preferencesParam) {
      // Get news based on user preferences
      const preferences = JSON.parse(preferencesParam);
      const categoryPromises = preferences.map((pref: string) => searchCategory(pref));
      const results = await Promise.all(categoryPromises);
      data = results.flat();
    } else {
      // Default behavior - get AI and Tech news
      data = (
        await Promise.all([
          searchSearxng('site:businessinsider.com AI', {
            engines: ['bing news'],
            pageno: 1,
          }),
          searchSearxng('site:www.exchangewire.com AI', {
            engines: ['bing news'],
            pageno: 1,
          }),
          searchSearxng('site:yahoo.com AI', {
            engines: ['bing news'],
            pageno: 1,
          }),
          searchSearxng('site:businessinsider.com tech', {
            engines: ['bing news'],
            pageno: 1,
          }),
          searchSearxng('site:www.exchangewire.com tech', {
            engines: ['bing news'],
            pageno: 1,
          }),
          searchSearxng('site:yahoo.com tech', {
            engines: ['bing news'],
            pageno: 1,
          }),
        ])
      )
        .map((result) => result.results)
        .flat();
    }
    
    // Shuffle the results
    data = data.sort(() => Math.random() - 0.5);

    return res.json({ blogs: data });
  } catch (err: any) {
    logger.error(`Error in discover route: ${err.message}`);
    return res.status(500).json({ message: 'An error has occurred' });
  }
});

// Get user preferences
router.get('/preferences', async (req, res) => {
  try {
    // In a real app, you would get the user ID from the session/auth
    const userId = req.query.userId as string || 'default-user';
    
    const userPrefs = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    
    if (userPrefs.length === 0) {
      // Return default preferences if none exist
      return res.json({ categories: ['AI', 'Technology'] });
    }
    
    return res.json({ categories: userPrefs[0].categories });
  } catch (err: any) {
    logger.error(`Error getting user preferences: ${err.message}`);
    return res.status(500).json({ message: 'An error has occurred' });
  }
});

// Update user preferences
router.post('/preferences', async (req, res) => {
  try {
    // In a real app, you would get the user ID from the session/auth
    const userId = req.query.userId as string || 'default-user';
    const { categories } = req.body;
    
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({ message: 'Invalid categories format' });
    }
    
    const userPrefs = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    
    if (userPrefs.length === 0) {
      // Create new preferences
      await db.insert(userPreferences).values({
        userId,
        categories,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Update existing preferences
      await db.update(userPreferences)
        .set({ 
          categories, 
          updatedAt: new Date().toISOString() 
        })
        .where(eq(userPreferences.userId, userId));
    }
    
    return res.json({ message: 'Preferences updated successfully' });
  } catch (err: any) {
    logger.error(`Error updating user preferences: ${err.message}`);
    return res.status(500).json({ message: 'An error has occurred' });
  }
});

export default router;
