import { Router, Response as ExpressResponse } from 'express';
import { z } from 'zod';
import fetch from 'node-fetch';
import { Response as FetchResponse } from 'node-fetch';
import { supabase } from '../lib/supabase';
import { env } from '../config/env';

const router = Router();

const searchSchema = z.object({
  query: z.string().min(1),
});

interface Business {
  id: string;
  name: string;
  description: string;
  website: string;
  phone: string | null;
  address: string | null;
}

interface SearxResult {
  url: string;
  title: string;
  content: string;
  engine: string;
  score: number;
}

interface SearxResponse {
  query: string;
  results: SearxResult[];
}

async function getCachedResults(query: string): Promise<Business[]> {
  console.log('Fetching cached results for query:', query);
  const normalizedQuery = query.toLowerCase()
    .trim()
    .replace(/,/g, '') // Remove commas
    .replace(/\s+/g, ' '); // Normalize whitespace
  
  const searchTerms = normalizedQuery.split(' ').filter(term => term.length > 0);
  console.log('Normalized search terms:', searchTerms);
  
  // First try exact match
  const { data: exactMatch } = await supabase
    .from('search_cache')
    .select('*')
    .eq('query', normalizedQuery)
    .single();

  if (exactMatch) {
    console.log('Found exact match in cache');
    return exactMatch.results as Business[];
  }

  // Then try fuzzy search
  console.log('Trying fuzzy search with terms:', searchTerms);
  const searchConditions = searchTerms.map(term => `query.ilike.%${term}%`);
  const { data: cachedResults, error } = await supabase
    .from('search_cache')
    .select('*')
    .or(searchConditions.join(','));

  if (error) {
    console.error('Error fetching cached results:', error);
    return [];
  }

  if (!cachedResults || cachedResults.length === 0) {
    console.log('No cached results found');
    return [];
  }

  console.log(`Found ${cachedResults.length} cached searches`);

  // Combine and deduplicate results from all matching searches
  const allResults = cachedResults.flatMap(cache => cache.results as Business[]);
  const uniqueResults = Array.from(new Map(allResults.map(item => [item.id, item])).values());

  console.log(`Combined into ${uniqueResults.length} unique businesses`);

  // Sort by relevance to search terms
  const sortedResults = uniqueResults.sort((a, b) => {
    const aScore = searchTerms.filter(term => 
      a.name.toLowerCase().includes(term) || 
      a.description.toLowerCase().includes(term)
    ).length;
    const bScore = searchTerms.filter(term => 
      b.name.toLowerCase().includes(term) || 
      b.description.toLowerCase().includes(term)
      ).length;
    return bScore - aScore;
  });

  return sortedResults;
}

async function searchSearxNG(query: string): Promise<Business[]> {
  console.log('Starting SearxNG search for query:', query);
  try {
    const params = new URLSearchParams({
      q: `${query} denver business`,
      format: 'json',
      language: 'en',
      time_range: '',
      safesearch: '1',
      engines: 'google,bing,duckduckgo'
    });

    const searchUrl = `${env.SEARXNG_URL}/search?${params.toString()}`;
    console.log('Searching SearxNG at URL:', searchUrl);

    const response: FetchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`SearxNG search failed: ${response.statusText} (${response.status})`);
    }

    const data = await response.json() as SearxResponse;
    console.log(`Got ${data.results?.length || 0} raw results from SearxNG`);
    console.log('Sample result:', data.results?.[0]);
    
    if (!data.results || data.results.length === 0) {
      return [];
    }

    const filteredResults = data.results
      .filter(result => 
        result.title && 
        result.url && 
        !result.url.includes('yelp.com/search') &&
        !result.url.includes('google.com/search') &&
        !result.url.includes('bbb.org/search') &&
        !result.url.includes('thumbtack.com/search') &&
        !result.url.includes('angi.com/search') &&
        !result.url.includes('yellowpages.com/search')
      );

    console.log(`Filtered to ${filteredResults.length} relevant results`);
    console.log('Sample filtered result:', filteredResults[0]);

    const searchTerms = query.toLowerCase().split(' ');
    const businesses = filteredResults
      .map(result => {
        const business = {
          id: result.url,
          name: cleanBusinessName(result.title),
          description: result.content || '',
          website: result.url,
          phone: extractPhone(result.content || '') || extractPhone(result.title),
          address: extractAddress(result.content || '') || extractAddress(result.title),
          score: result.score || 0
        };
        console.log('Processed business:', business);
        return business;
      })
      .filter(business => {
        // Check if business name contains any of the search terms
        const nameMatches = searchTerms.some(term => 
          business.name.toLowerCase().includes(term)
        );
        
        // Check if description contains any of the search terms
        const descriptionMatches = searchTerms.some(term => 
          business.description.toLowerCase().includes(term)
        );
        
        return business.name.length > 2 && (nameMatches || descriptionMatches);
      })
      .sort((a, b) => {
        // Score based on how many search terms match the name and description
        const aScore = searchTerms.filter(term => 
          a.name.toLowerCase().includes(term) || 
          a.description.toLowerCase().includes(term)
        ).length;
        const bScore = searchTerms.filter(term => 
          b.name.toLowerCase().includes(term) || 
          b.description.toLowerCase().includes(term)
        ).length;
        return bScore - aScore;
      })
      .slice(0, 10);

    console.log(`Transformed into ${businesses.length} business entries`);
    return businesses;
  } catch (error) {
    console.error('SearxNG search error:', error);
    return [];
  }
}

async function cacheResults(query: string, results: Business[]): Promise<void> {
  if (!results.length) return;

  console.log(`Caching ${results.length} results for query:`, query);
  const normalizedQuery = query.toLowerCase().trim();
  
  const { data: existing } = await supabase
    .from('search_cache')
    .select('id, results')
    .eq('query', normalizedQuery)
    .single();

  if (existing) {
    console.log('Updating existing cache entry');
    // Merge new results with existing ones, removing duplicates
    const allResults = [...existing.results, ...results];
    const uniqueResults = Array.from(new Map(allResults.map(item => [item.id, item])).values());

    await supabase
      .from('search_cache')
      .update({ 
        results: uniqueResults,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    console.log('Creating new cache entry');
    await supabase
      .from('search_cache')
      .insert({
        query: normalizedQuery,
        results,
        location: 'denver', // Default location
        category: 'business', // Default category
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
      });
  }
}

function cleanBusinessName(title: string): string {
  return title
    .replace(/^(the\s+)?/i, '')
    .replace(/\s*[-|]\s*.+$/i, '')
    .replace(/\s*\|.*$/i, '')
    .replace(/\s*in\s+denver.*$/i, '')
    .replace(/\s*near\s+denver.*$/i, '')
    .replace(/\s*-\s*.*denver.*$/i, '')
    .trim();
}

function extractPhone(text: string): string | null {
  const phoneRegex = /(\+?1?\s*\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/;
  const match = text.match(phoneRegex);
  return match ? match[1] : null;
}

function extractAddress(text: string): string | null {
  const addressRegex = /\d+\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct|Circle|Cir)[,\s]+(?:[A-Za-z\s]+,\s*)?(?:CO|Colorado)[,\s]+\d{5}(?:-\d{4})?/i;
  const match = text.match(addressRegex);
  return match ? match[0] : null;
}

router.post('/search', async (req, res) => {
  try {
    console.log('Received search request:', req.body);
    const { query } = searchSchema.parse(req.body);
    await handleSearch(query, res);
  } catch (error) {
    console.error('Search error:', error);
    res.status(400).json({ error: 'Search failed. Please try again.' });
  }
});

// Also support GET requests for easier testing
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    console.log('Received search request:', { query });
    await handleSearch(query, res);
  } catch (error) {
    console.error('Search error:', error);
    res.status(400).json({ error: 'Search failed. Please try again.' });
  }
});

// Helper function to handle search logic
async function handleSearch(query: string, res: ExpressResponse) {
  // Get cached results immediately
  const cachedResults = await getCachedResults(query);
  console.log(`Returning ${cachedResults.length} cached results to client`);
  
  // Send cached results to client
  res.json({ results: cachedResults });
  
  // Search for new results in the background
  console.log('Starting background search');
  searchSearxNG(query).then(async newResults => {
    console.log(`Found ${newResults.length} new results from SearxNG`);
    if (newResults.length > 0) {
      await cacheResults(query, newResults);
    }
  }).catch(error => {
    console.error('Background search error:', error);
  });
}

export default router;
