import { db, newsArticles, testConnection, initializeTables } from '@/lib/db/postgres';
import { eq, desc, and, sql } from 'drizzle-orm';

// Initialize database on module load
initializeTables().catch(console.error);

// POST endpoint - Receive batch news data from crawler
export const POST = async (req: Request) => {
  try {
    const body = await req.json();
    
    // Validate request body
    if (!body.source || !body.articles || !Array.isArray(body.articles)) {
      return Response.json(
        {
          message: 'Invalid request. Required fields: source, articles (array)',
        },
        { status: 400 }
      );
    }

    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      return Response.json(
        {
          message: 'Database connection failed. Using fallback storage.',
          warning: 'Data may not be persisted.',
        },
        { status: 503 }
      );
    }

    const { source, articles } = body;
    const processedArticles = [];
    const timestamp = new Date();

    // Process and store each article in PostgreSQL
    for (const article of articles) {
      if (!article.title || !article.content) {
        continue; // Skip articles without required fields
      }

      try {
        // Prepare article data for insertion
        const articleData = {
          source,
          title: article.title,
          content: article.content,
          url: article.url || null,
          publishedAt: article.publishedAt ? new Date(article.publishedAt) : timestamp,
          author: article.author || null,
          category: article.category || null,
          summary: article.summary || article.content.substring(0, 200) + '...',
          metadata: article.metadata || {},
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        // Insert into PostgreSQL
        const [insertedArticle] = await db
          .insert(newsArticles)
          .values(articleData)
          .returning();

        processedArticles.push(insertedArticle);
      } catch (dbError) {
        console.error('Error inserting article:', dbError);
        // Continue processing other articles even if one fails
      }
    }

    // Get total count of articles in database
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(newsArticles);
    const totalStored = Number(totalCountResult[0]?.count || 0);

    return Response.json({
      message: 'News articles received and stored successfully',
      source,
      articlesReceived: articles.length,
      articlesProcessed: processedArticles.length,
      totalStored,
      processedArticles,
      storage: 'PostgreSQL',
    });
  } catch (err) {
    console.error('Error processing news batch:', err);
    return Response.json(
      {
        message: 'An error occurred while processing news batch',
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};

// GET endpoint - Return latest news articles from PostgreSQL
export const GET = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);
    const source = url.searchParams.get('source');
    const category = url.searchParams.get('category');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      return Response.json(
        {
          message: 'Database connection failed',
          news: [],
        },
        { status: 503 }
      );
    }

    // Build query conditions
    const conditions = [];
    if (source) {
      conditions.push(eq(newsArticles.source, source));
    }
    if (category) {
      conditions.push(eq(newsArticles.category, category));
    }

    // Query database with filters
    const query = db
      .select()
      .from(newsArticles)
      .orderBy(desc(newsArticles.createdAt))
      .limit(limit)
      .offset(offset);

    // Apply conditions if any
    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    const results = await query;

    // Get total count for pagination
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(newsArticles);
    
    if (conditions.length > 0) {
      countQuery.where(and(...conditions));
    }

    const totalCountResult = await countQuery;
    const totalCount = Number(totalCountResult[0]?.count || 0);

    return Response.json({
      success: true,
      total: totalCount,
      returned: results.length,
      limit,
      offset,
      news: results,
      storage: 'PostgreSQL',
      pagination: {
        hasMore: offset + limit < totalCount,
        nextOffset: offset + limit < totalCount ? offset + limit : null,
      },
    });
  } catch (err) {
    console.error('Error fetching news:', err);
    return Response.json(
      {
        message: 'An error occurred while fetching news',
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};