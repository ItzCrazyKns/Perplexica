import axios from 'axios';
import * as cheerio from 'cheerio';
import { createWorker } from 'tesseract.js';
import { env } from '../config/env';
import { OllamaService } from './services/ollamaService';
import { BusinessData } from './types';
import { db } from './services/databaseService';
import { generateBusinessId } from './utils';
import { extractContactFromHtml, extractCleanAddress } from './utils/scraper';
import { GeocodingService } from './services/geocodingService';
import { cleanAddress, formatPhoneNumber, cleanEmail, cleanDescription } from './utils/dataCleanup';
import { CleanupService } from './services/cleanupService';

// Define interfaces used only in this file
interface SearchResult {
    url: string;
    title: string;
    content: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
    rating?: number;
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
        console.log('Processing search query:', query);
        const [searchTerm, location] = query.split(' in ').map(s => s.trim());
        if (!searchTerm || !location) {
            throw new Error('Invalid search query format. Use: "search term in location"');
        }

        options.onProgress?.('Checking cache', 0);

        // Check cache first
        const cacheKey = `search:${searchTerm}:${location}`;
        let results = await db.getFromCache(cacheKey);
        
        if (!results) {
            // Check database for existing businesses
            console.log('Searching database for:', searchTerm, 'in', location);
            const existingBusinesses = await db.searchBusinesses(searchTerm, location);
            
            // Start search immediately
            console.log('Starting web search');
            const searchPromise = performSearch(searchTerm, location, options);
            
            if (existingBusinesses.length > 0) {
                console.log(`Found ${existingBusinesses.length} existing businesses`);
                options.onProgress?.('Retrieved from database', 50);
            }

            // Wait for new results
            const newResults = await searchPromise;
            console.log(`Got ${newResults.length} new results from search`);
            
            // Merge results, removing duplicates by ID
            const allResults = [...existingBusinesses];
            for (const result of newResults) {
                if (!allResults.some(b => b.id === result.id)) {
                    allResults.push(result);
                }
            }
            
            console.log(`Total unique results: ${allResults.length}`);
            
            // Cache combined results
            await db.saveToCache(cacheKey, allResults, env.cache.durationHours * 60 * 60 * 1000);
            
            console.log(`Returning ${allResults.length} total results (${existingBusinesses.length} existing + ${newResults.length} new)`);
            results = allResults;
        }

        // Clean all results using LLM
        options.onProgress?.('Cleaning data', 75);
        const cleanedResults = await CleanupService.cleanBusinessRecords(results);

        options.onProgress?.('Search complete', 100);
        return cleanedResults;
    } catch (error) {
        console.error('Search error:', error);
        return [];
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
    // Skip listing/directory pages and search results
    const skipPatterns = [
        'tripadvisor.com',
        'yelp.com',
        'opentable.com',
        'restaurants-for-sale',
        'guide.michelin.com',
        'denver.org',
        '/blog/',
        '/maps/',
        'search?',
        'features/',
        '/lists/',
        'reddit.com',
        'eater.com'
    ];

    if (skipPatterns.some(pattern => result.url.toLowerCase().includes(pattern))) {
        console.log(`Skipping listing page: ${result.url}`);
        return false;
    }

    // Must have a title
    if (!result.title || result.title.length < 2) {
        return false;
    }

    // Skip results that look like articles or lists
    const articlePatterns = [
        'Best',
        'Top',
        'Guide',
        'Where to',
        'Welcome to',
        'Updated',
        'Near',
        'Restaurants in'
    ];

    if (articlePatterns.some(pattern => result.title.includes(pattern))) {
        console.log(`Skipping article: ${result.title}`);
        return false;
    }

    // Only accept results that look like actual business pages
    const businessPatterns = [
        'menu',
        'reservation',
        'location',
        'contact',
        'about-us',
        'home'
    ];

    const hasBusinessPattern = businessPatterns.some(pattern => 
        result.url.toLowerCase().includes(pattern) || 
        result.content.toLowerCase().includes(pattern)
    );

    if (!hasBusinessPattern) {
        console.log(`Skipping non-business page: ${result.url}`);
        return false;
    }

    return true;
}

async function processResults(results: SearchResult[], location: string): Promise<BusinessData[]> {
    const processedResults: BusinessData[] = [];
    
    // Get coordinates for the location
    const locationGeo = await GeocodingService.geocode(location);
    const defaultCoords = locationGeo || { lat: 39.7392, lng: -104.9903 };

    for (const result of results) {
        try {
            // Extract contact info from webpage
            const contactInfo = await extractContactFromHtml(result.url);
            
            // Create initial business record
            const business: BusinessData = {
                id: generateBusinessId(result),
                name: cleanBusinessName(result.title),
                phone: result.phone || contactInfo.phone || '',
                email: result.email || contactInfo.email || '',
                address: result.address || contactInfo.address || '',
                rating: result.rating || 0,
                website: result.website || result.url || '',
                logo: '',
                source: 'web',
                description: result.content || contactInfo.description || '',
                location: defaultCoords,
                openingHours: contactInfo.openingHours
            };

            // Clean up the record using LLM
            const cleanedBusiness = await CleanupService.cleanBusinessRecord(business);

            // Get coordinates for cleaned address
            if (cleanedBusiness.address) {
                const addressGeo = await GeocodingService.geocode(cleanedBusiness.address);
                if (addressGeo) {
                    cleanedBusiness.location = addressGeo;
                }
            }

            // Only add if we have at least a name and either phone or address
            if (cleanedBusiness.name && (cleanedBusiness.phone || cleanedBusiness.address)) {
                processedResults.push(cleanedBusiness);
            }

        } catch (error) {
            console.error(`Error processing result ${result.title}:`, error);
        }
    }

    return processedResults;
}

// Helper functions
function cleanBusinessName(name: string): string {
    // Remove common suffixes and prefixes
    const cleanName = name
        .replace(/^(The|A|An)\s+/i, '')
        .replace(/\s+(-|–|—|:).*$/, '')
        .replace(/\s*\([^)]*\)/g, '')
        .trim();
    
    return cleanName;
}

async function getLocationCoordinates(address: string): Promise<{lat: number, lng: number}> {
    // Implement geocoding here
    // For now, return default coordinates for Denver
    return { lat: 39.7392, lng: -104.9903 };
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
