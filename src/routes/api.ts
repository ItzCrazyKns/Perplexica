import express from 'express';
import { SearchService } from '../lib/services/searchService';
import { Business } from '../lib/types';

const router = express.Router();
const searchService = new SearchService();

// Error handling middleware for JSON parsing errors
router.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({ 
            success: false,
            error: 'Invalid JSON' 
        });
    }
    next();
});

// Business categories endpoint
router.get('/categories', (req, res) => {
  const categories = [
    'Restaurant',
    'Retail',
    'Service',
    'Healthcare',
    'Professional',
    'Entertainment',
    'Education',
    'Technology',
    'Manufacturing',
    'Construction',
    'Transportation',
    'Real Estate',
    'Financial',
    'Legal',
    'Other'
  ];
  res.json(categories);
});

// Streaming search endpoint
router.post('/search/stream', (req, res) => {
    const { query, location } = req.body;
    
    if (!query || !location) {
        return res.status(400).json({
            success: false,
            error: 'Query and location are required'
        });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial message
    res.write('data: {"type":"start","message":"Starting search..."}\n\n');

    // Create search service instance for this request
    const search = new SearchService();

    // Listen for individual results
    search.on('result', (business: Business) => {
        res.write(`data: {"type":"result","business":${JSON.stringify(business)}}\n\n`);
    });

    // Listen for progress updates
    search.on('progress', (data: any) => {
        res.write(`data: {"type":"progress","data":${JSON.stringify(data)}}\n\n`);
    });

    // Listen for completion
    search.on('complete', () => {
        res.write('data: {"type":"complete","message":"Search complete"}\n\n');
        res.end();
    });

    // Listen for errors
    search.on('error', (error: Error) => {
        res.write(`data: {"type":"error","message":${JSON.stringify(error.message)}}\n\n`);
        res.end();
    });

    // Start the search
    search.streamSearch(query, location).catch(error => {
        console.error('Search error:', error);
        res.write(`data: {"type":"error","message":${JSON.stringify(error.message)}}\n\n`);
        res.end();
    });
});

// Regular search endpoint (non-streaming)
router.post('/search', async (req, res) => {
    const { query, location } = req.body;
    
    if (!query || !location) {
        return res.status(400).json({
            success: false,
            error: 'Query and location are required'
        });
    }

    try {
        const results = await searchService.search(query, location);
        res.json({
            success: true,
            results
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred during search';
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

// Get business by ID
router.get('/business/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const business = await searchService.getBusinessById(id);
        
        if (!business) {
            return res.status(404).json({
                success: false,
                error: 'Business not found'
            });
        }

        res.json({
            success: true,
            business
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch business details';
        console.error('Error fetching business:', error);
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

export default router; 