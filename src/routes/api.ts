import express from 'express';
import { SearchService } from '../lib/services/searchService';

const router = express.Router();
const searchService = new SearchService();

// Error handling middleware for JSON parsing errors
router.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next();
});

// Search endpoint
router.post('/search', async (req, res) => {
  try {
    const { query, location } = req.body;
    
    if (!query || !location) {
      return res.status(400).json({
        error: 'Query and location are required'
      });
    }

    const results = await searchService.search(query, location);
    res.json({ results });
  } catch (error: any) {
    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded'
      });
    }

    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// Get business details endpoint
router.get('/business/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const business = await searchService.getBusinessById(id);

    if (!business) {
      return res.status(404).json({
        error: 'Business not found'
      });
    }

    res.json(business);
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

export default router; 