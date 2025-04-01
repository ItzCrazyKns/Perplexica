import { getSearchQueriesForCategory, DEFAULT_SOURCES } from './categories';
import { searchCategory, getDefaultResults, processResults } from './search';

export const GET = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const preferencesParam = url.searchParams.get('preferences');
    const languagesParam = url.searchParams.get('languages');
    
    console.log(`[Discover] Request received: category=${category}, preferences=${preferencesParam}, languages=${languagesParam}`);
    
    let data: any[] = [];
    let languages: string[] = [];
    
    // Parse languages parameter
    if (languagesParam) {
      try {
        const parsedLanguages = JSON.parse(languagesParam);
        if (Array.isArray(parsedLanguages)) {
          languages = parsedLanguages;
        }
      } catch (err) {
        console.error(`[Discover] Error parsing languages: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    console.log(`[Discover] Using languages: ${JSON.stringify(languages)}`);
    
    // Handle category-specific searches
    if (category && category !== 'For You') {
      console.log(`[Discover] Searching for category: ${category}`);
      data = await searchCategory(category, languages, getSearchQueriesForCategory);
    } 
    // Handle preference-based searches
    else if (preferencesParam) {
      try {
        const preferences = JSON.parse(preferencesParam);
        if (Array.isArray(preferences) && preferences.length > 0) {
          console.log(`[Discover] Searching for preferences: ${JSON.stringify(preferences)}`);
          // Get content for each preferred category
          const categoryPromises = preferences.map((pref: string) => 
            searchCategory(pref, languages, getSearchQueriesForCategory)
          );
          const results = await Promise.all(categoryPromises);
          data = results.flat();
        } else {
          console.log(`[Discover] No valid preferences found, using default search`);
          // Fallback to default behavior
          data = await getDefaultResults(languages, DEFAULT_SOURCES);
        }
      } catch (err) {
        console.error(`[Discover] Error with preferences: ${err instanceof Error ? err.message : String(err)}`);
        data = await getDefaultResults(languages, DEFAULT_SOURCES);
      }
    } 
    // Default search behavior
    else {
      console.log(`[Discover] Using default search`);
      data = await getDefaultResults(languages, DEFAULT_SOURCES);
    }

    console.log(`[Discover] Found ${data.length} results before filtering`);
    
    // Process and filter results for display
    const finalData = processResults(data);
    
    console.log(`[Discover] Found ${finalData.length} results after filtering`);

    return Response.json(
      {
        blogs: finalData,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error(`[Discover] An error occurred in discover route: ${err instanceof Error ? err.message : String(err)}`);
    console.error(`[Discover] Error stack: ${err instanceof Error ? err.stack : 'No stack trace available'}`);
    return Response.json(
      {
        message: 'An error has occurred',
      },
      {
        status: 500,
      },
    );
  }
};
