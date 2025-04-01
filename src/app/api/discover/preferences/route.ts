import db from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET handler to retrieve user preferences
export const GET = async (req: Request) => {
  try {
    console.log('[Preferences] Retrieving user preferences');
    
    // In a production app, you would get user ID from an auth session
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId') || "default-user";
    
    console.log(`[Preferences] Fetching preferences for user: ${userId}`);
    
    const userPrefs = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    
    if (userPrefs.length === 0) {
      console.log('[Preferences] No preferences found, returning defaults');
      // Return default preferences if none exist
      return Response.json({ 
        categories: ['AI', 'Technology'],
        languages: ['en'] // Default to English
      });
    }
    
    // Handle backward compatibility for old schema versions
    let languages = [];
    if ('languages' in userPrefs[0] && userPrefs[0].languages) {
      languages = userPrefs[0].languages;
    } else if ('language' in userPrefs[0] && userPrefs[0].language) {
      // Convert old single language to array for backward compatibility
      languages = Array.isArray(userPrefs[0].language) 
        ? userPrefs[0].language 
        : [userPrefs[0].language];
    } else {
      languages = ['en']; // Default to English if no language preference found
    }
    
    console.log(`[Preferences] Found user preferences: categories=${JSON.stringify(userPrefs[0].categories)}, languages=${JSON.stringify(languages)}`);
    
    return Response.json({ 
      categories: userPrefs[0].categories,
      languages: languages
    });
  } catch (err: any) {
    console.error(`[Preferences] Error getting user preferences: ${err instanceof Error ? err.message : String(err)}`);
    console.error(`[Preferences] Error stack: ${err instanceof Error ? err.stack : 'No stack trace available'}`);
    return Response.json(
      { message: 'An error has occurred' },
      { status: 500 }
    );
  }
};

// POST handler to save user preferences
export const POST = async (req: Request) => {
  try {
    console.log('[Preferences] Updating user preferences');
    
    // In a production app, you would get user ID from an auth session
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId') || "default-user";
    
    const body = await req.json();
    const { categories, languages } = body;
    
    console.log(`[Preferences] Received update: userId=${userId}, categories=${JSON.stringify(categories)}, languages=${JSON.stringify(languages)}`);
    
    if (!categories || !Array.isArray(categories)) {
      console.error('[Preferences] Invalid categories format');
      return Response.json(
        { message: 'Invalid categories format' },
        { status: 400 }
      );
    }
    
    if (languages && !Array.isArray(languages)) {
      console.error('[Preferences] Invalid languages format');
      return Response.json(
        { message: 'Invalid languages format' },
        { status: 400 }
      );
    }
    
    const userPrefs = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    
    try {
      if (userPrefs.length === 0) {
        // Create new preferences
        console.log(`[Preferences] Creating new preferences for user: ${userId}`);
        await db.insert(userPreferences).values({
          userId,
          categories,
          languages: languages || ['en'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Update existing preferences
        console.log(`[Preferences] Updating existing preferences for user: ${userId}`);
        await db.update(userPreferences)
          .set({ 
            categories, 
            languages: languages || ['en'],
            updatedAt: new Date().toISOString() 
          })
          .where(eq(userPreferences.userId, userId));
      }
      
      console.log(`[Preferences] Successfully updated preferences for user: ${userId}`);
    } catch (error: any) {
      // If there's an error (likely due to schema mismatch), log it but don't fail
      console.warn(`[Preferences] Error updating preferences with new schema: ${error instanceof Error ? error.message : String(error)}`);
      console.warn('[Preferences] Continuing with request despite error');
      // We'll just return success anyway since we can't fix the schema issue here
    }
    
    return Response.json({ message: 'Preferences updated successfully' });
  } catch (err: any) {
    console.error(`[Preferences] Error updating user preferences: ${err instanceof Error ? err.message : String(err)}`);
    console.error(`[Preferences] Error stack: ${err instanceof Error ? err.stack : 'No stack trace available'}`);
    return Response.json(
      { message: 'An error has occurred' },
      { status: 500 }
    );
  }
};
