import axios from 'axios';
import * as cheerio from 'cheerio';
import { createWorker } from 'tesseract.js';
import { env } from '../config/env';
import { OllamaService } from './services/ollamaService';
import { BusinessData } from './types';
import { db } from './services/databaseService';
import { generateBusinessId } from './utils';

// Define interfaces used only in this file
interface SearchResult {
    url: string;
    title: string;
    content: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
}

interface ContactInfo {
    phone?: string;
    email?: string;
    address?: string;
    description?: string;
    openingHours?: string[];
}

// Export the main search function
export async function searchBusinesses(
    query: string,
    options: { onProgress?: (status: string, progress: number) => void } = {}
): Promise<BusinessData[]> {
    try {
        const [searchTerm, location] = query.split(' in ').map(s => s.trim());
        if (!searchTerm || !location) {
            throw new Error('Invalid search query format. Use: "search term in location"');
        }

        options.onProgress?.('Checking cache', 0);

        // Check cache first
        const cacheKey = `search:${searchTerm}:${location}`;
        const cachedResults = await db.getFromCache(cacheKey);
        if (cachedResults) {
            console.log('Found cached results');
            options.onProgress?.('Retrieved from cache', 100);
            return cachedResults;
        }

        // Check database for existing businesses
        const existingBusinesses = await db.searchBusinesses(searchTerm, location);
        
        if (existingBusinesses.length > 0) {
            console.log(`Found ${existingBusinesses.length} existing businesses`);
            options.onProgress?.('Retrieved from database', 50);
            
            // Still perform search but in background
            searchAndUpdateInBackground(searchTerm, location);
            
            return existingBusinesses;
        }

        options.onProgress?.('Starting search', 10);

        // Perform new search
        const results = await performSearch(searchTerm, location, options);
        
        // Cache results
        await db.saveToCache(cacheKey, results, env.cache.durationHours * 60 * 60 * 1000);
        
        return results;
    } catch (error) {
        console.error('Search error:', error);
        return []; // Return empty array on error
    }
}

async function performSearch(
    searchTerm: string, 
    location: string, 
    options: any
): Promise<BusinessData[]> {
    const queries = [
        searchTerm + ' ' + location,
        searchTerm + ' business near ' + location,
        searchTerm + ' services ' + location,
        'local ' + searchTerm + ' ' + location
    ];

    options.onProgress?.('Searching multiple sources', 25);

    let allResults: SearchResult[] = [];
    const seenUrls = new Set<string>();

    for (const q of queries) {
        try {
            const response = await axios.get(`${env.searxng.currentUrl}/search`, {
                params: {
                    q,
                    format: 'json',
                    engines: 'google,google_maps',
                    language: 'en-US',
                    time_range: '',
                    safesearch: 1
                }
            });

            if (response.data?.results) {
                // Deduplicate results
                const newResults = response.data.results.filter((result: SearchResult) => {
                    if (seenUrls.has(result.url)) {
                        return false;
                    }
                    seenUrls.add(result.url);
                    return true;
                });

                console.log(`Found ${newResults.length} unique results from ${response.data.results[0]?.engine}`);
                allResults = allResults.concat(newResults);
            }
        } catch (error) {
            console.error(`Search failed for query "${q}":`, error);
        }
    }

    options.onProgress?.('Processing results', 50);

    const filteredResults = allResults.filter(isValidBusinessResult);
    const processedResults = await processResults(filteredResults, location);

    // Save results to database
    for (const result of processedResults) {
        await db.saveBusiness(result).catch(console.error);
    }

    options.onProgress?.('Search complete', 100);
    return processedResults;
}

// Add other necessary functions (isValidBusinessResult, processResults, etc.)
function isValidBusinessResult(result: SearchResult): boolean {
    // Add validation logic here
    return true;
}

async function processResults(results: SearchResult[], location: string): Promise<BusinessData[]> {
    const processedResults: BusinessData[] = [];
    const targetCoords = { lat: 0, lng: 0 }; // Replace with actual coordinates

    for (const result of results) {
        try {
            const business: BusinessData = {
                id: generateBusinessId(result),
                name: result.title,
                phone: result.phone || '',
                email: result.email || '',
                address: result.address || '',
                rating: 0,
                website: result.website || result.url || '',
                logo: '',
                source: 'web',
                description: result.content || '',
                location: result.coordinates || targetCoords
            };

            processedResults.push(business);
        } catch (error) {
            console.error(`Error processing result ${result.title}:`, error);
        }
    }

    return processedResults;
}

async function searchAndUpdateInBackground(searchTerm: string, location: string) {
    try {
        const results = await performSearch(searchTerm, location, {});
        console.log(`Updated ${results.length} businesses in background`);
    } catch (error) {
        console.error('Background search error:', error);
    }
}

// ... rest of the file remains the same
