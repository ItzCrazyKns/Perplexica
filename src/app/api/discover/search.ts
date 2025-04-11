import { searchSearxng } from '@/lib/searxng';
import { LANGUAGE_SPECIFIC_ENGINES } from './languages';

// Define the search options interface to match the one in lib/searxng.ts
interface SearxngSearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
}

/**
 * Default search engines to use, in priority order
 */
export const DEFAULT_ENGINES = ['bing news', 'brave news', 'duckduckgo news'];

/**
 * Search with multiple engines as fallbacks
 * Tries each engine in sequence until results are found or engines exhausted
 */
export async function searchWithMultipleEngines(
  query: string, 
  language: string,
  engines: string[] = DEFAULT_ENGINES
): Promise<any[]> {
  let allResults: any[] = [];
  let hasResults = false;
  
  // Try each engine in sequence until we get results or run out of engines
  for (const engine of engines) {
    try {
      console.log(`[Discover] Trying engine "${engine}" for query "${query}" in language "${language || 'default'}"`);
      
      const searchOptions: SearxngSearchOptions = {
        engines: [engine],
        pageno: 1,
      };
      
      if (language) {
        searchOptions.language = language;
      }
      
      const result = await searchSearxng(query, searchOptions);
      
      if (result.results && result.results.length > 0) {
        console.log(`[Discover] Found ${result.results.length} results from engine "${engine}"`);
        allResults.push(...result.results);
        hasResults = true;
        
        // If we've found enough results, stop trying more engines
        if (allResults.length >= 20) {
          break;
        }
      } else {
        console.log(`[Discover] No results from engine "${engine}", trying next engine if available`);
      }
    } catch (err) {
      console.error(`[Discover] Error searching with engine "${engine}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  
  return allResults;
}

/**
 * Search for a specific category across multiple languages and engines
 */
export async function searchCategory(
  category: string, 
  languages: string[] = [], 
  getQueries: (cat: string, lang?: string) => { site: string; keyword: string }[]
): Promise<any[]> {
  console.log(`[Discover] Searching category "${category}" in languages: ${JSON.stringify(languages)}`);
  
  // If no languages specified or empty array, search in English
  if (!languages || languages.length === 0) {
    const queries = getQueries(category);
    const searchPromises = queries.map(query => 
      searchWithMultipleEngines(`site:${query.site} ${query.keyword}`, '')
    );
    
    const results = await Promise.all(searchPromises);
    return results.flat();
  }
  
  // If languages specified, search each language and combine results
  const allResults = [];
  
  for (const language of languages) {
    console.log(`[Discover] Searching in language: ${language}`);
    
    // Get language-specific engines if available, otherwise use defaults
    const engines = LANGUAGE_SPECIFIC_ENGINES[language] || DEFAULT_ENGINES;
    
    // Get language-specific queries
    const queries = getQueries(category, language);
    
    const searchPromises = queries.map(query => {
      // For Chinese languages, don't use the site: operator
      const isChinese = language.startsWith('zh');
      const queryString = isChinese ? query.keyword : `site:${query.site} ${query.keyword}`;
      return searchWithMultipleEngines(queryString, language, engines);
    });
    
    const results = await Promise.all(searchPromises);
    allResults.push(...results.flat());
  }
  
  return allResults;
}

/**
 * Helper function for default search behavior that supports multiple languages
 */
export async function getDefaultResults(
  languages: string[] = [], 
  defaultSources: { site: string; keyword: string }[]
): Promise<any[]> {
  console.log(`[Discover] Getting default results for languages: ${JSON.stringify(languages)}`);
  
  // If no languages specified, search with no language filter
  if (languages.length === 0) {
    const searchPromises = defaultSources.map(query => 
      searchWithMultipleEngines(`site:${query.site} ${query.keyword}`, '')
    );
    
    const results = await Promise.all(searchPromises);
    return results.flat();
  }
  
  // Otherwise, search each language separately and combine results
  let allResults: any[] = [];
  
  for (const language of languages) {
    console.log(`[Discover] Default search in language: ${language}`);
    
    // Get language-specific engines if available, otherwise use defaults
    const engines = LANGUAGE_SPECIFIC_ENGINES[language] || DEFAULT_ENGINES;
    
    const searchPromises = defaultSources.map(query => {
      // For Chinese languages, don't use the site: operator
      const isChinese = language.startsWith('zh');
      const queryString = isChinese ? query.keyword : `site:${query.site} ${query.keyword}`;
      return searchWithMultipleEngines(queryString, language, engines);
    });
    
    const results = await Promise.all(searchPromises);
    allResults.push(...results.flat());
  }
  
  return allResults;
}

/**
 * Process results to filter and prepare for display
 */
export function processResults(results: any[]): any[] {
  // Filter out items without thumbnails
  const resultsWithThumbnails = results.filter((item) => item.thumbnail);
  
  // If there are no results with thumbnails but we have results without thumbnails,
  // use some of the results without thumbnails rather than showing nothing
  let finalResults = resultsWithThumbnails;
  if (resultsWithThumbnails.length === 0 && results.length > 0) {
    console.log(`[Discover] No results with thumbnails found, using up to 10 results without thumbnails`);
    finalResults = results.slice(0, 10);  // Limit to 10 results without thumbnails
  } else {
    finalResults = resultsWithThumbnails;
  }
  
  // Shuffle the results
  return finalResults.sort(() => Math.random() - 0.5);
}
