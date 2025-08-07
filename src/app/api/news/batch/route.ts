// Temporary in-memory storage for news articles
const newsStorage: Array<{
  id: string;
  source: string;
  title: string;
  content: string;
  url?: string;
  publishedAt: string;
  author?: string;
  category?: string;
  summary?: string;
  createdAt: string;
}> = [];

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

    const { source, articles } = body;
    const processedArticles = [];
    const timestamp = new Date().toISOString();

    // Process and store each article
    for (const article of articles) {
      if (!article.title || !article.content) {
        continue; // Skip articles without required fields
      }

      const newsItem = {
        id: `${source}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source,
        title: article.title,
        content: article.content,
        url: article.url || '',
        publishedAt: article.publishedAt || timestamp,
        author: article.author || '',
        category: article.category || '',
        summary: article.summary || article.content.substring(0, 200) + '...',
        createdAt: timestamp,
      };

      newsStorage.push(newsItem);
      processedArticles.push(newsItem);
    }

    // Keep only the latest 1000 articles in memory
    if (newsStorage.length > 1000) {
      newsStorage.splice(0, newsStorage.length - 1000);
    }

    return Response.json({
      message: 'News articles received successfully',
      source,
      articlesReceived: articles.length,
      articlesProcessed: processedArticles.length,
      totalStored: newsStorage.length,
      processedArticles,
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

// GET endpoint - Return latest 10 news articles
export const GET = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const source = url.searchParams.get('source');
    const category = url.searchParams.get('category');

    let filteredNews = [...newsStorage];

    // Apply filters if provided
    if (source) {
      filteredNews = filteredNews.filter(news => news.source === source);
    }
    if (category) {
      filteredNews = filteredNews.filter(news => news.category === category);
    }

    // Sort by createdAt (newest first) and limit results
    const latestNews = filteredNews
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, Math.min(limit, 100)); // Max 100 items

    return Response.json({
      success: true,
      total: newsStorage.length,
      filtered: filteredNews.length,
      returned: latestNews.length,
      news: latestNews,
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