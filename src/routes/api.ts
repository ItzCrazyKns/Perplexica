import { Router } from 'express';
import { searchBusinesses } from '../lib/searxng';
import { categories } from '../lib/categories';
import { supabase } from '../lib/supabase';
import { BusinessData } from '../lib/types';

const router = Router();

// Categories endpoint
router.get('/categories', (req, res) => {
  res.json(categories);
});

// Search endpoint
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q as string;
        const [searchTerm, location] = query.split(' in ');
        
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Set headers for streaming response
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');

        // First, search in Supabase
        const { data: existingResults, error: dbError } = await supabase
            .from('businesses')
            .select('*')
            .or(`name.ilike.%${searchTerm}%, description.ilike.%${searchTerm}%`)
            .ilike('address', `%${location}%`);

        if (dbError) {
            console.error('Supabase search error:', dbError);
        }

        // Send existing results immediately if there are any
        if (existingResults && existingResults.length > 0) {
            const chunk = JSON.stringify({ 
                source: 'database',
                results: existingResults 
            }) + '\n';
            res.write(chunk);
        }

        // Start background search
        const searchPromise = searchBusinesses(query, {
            onProgress: (status, progress) => {
                const chunk = JSON.stringify({ 
                    source: 'search',
                    status,
                    progress,
                }) + '\n';
                res.write(chunk);
            }
        });

        const results = await searchPromise;
        
        // Send final results
        const finalChunk = JSON.stringify({ 
            source: 'search',
            results,
            complete: true 
        }) + '\n';
        res.write(finalChunk);
        res.end();

    } catch (error: unknown) {
        console.error('Search error:', error);
        const errorResponse = { 
            error: 'An error occurred while searching',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
        
        // Only send error response if headers haven't been sent
        if (!res.headersSent) {
            res.status(500).json(errorResponse);
        } else {
            res.write(JSON.stringify(errorResponse));
            res.end();
        }
    }
});

export default router; 