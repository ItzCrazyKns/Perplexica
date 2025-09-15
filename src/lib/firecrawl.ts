import { FirecrawlAppV1 } from '@mendable/firecrawl-js';

let app: FirecrawlAppV1 | null = null;

export const isFirecrawlEnabled = () => {
  return Boolean(process.env.FIRECRAWL_API_KEY);
};

const getApp = () => {
  if (!isFirecrawlEnabled()) return null;
  if (app) return app;
  app = new FirecrawlAppV1({ apiKey: process.env.FIRECRAWL_API_KEY! });
  return app;
};

export type FirecrawlData = {
  markdown?: string;
  html?: string;
  raw?: string;
  metadata?: Record<string, any> & { title?: string; url?: string };
};

export async function crawlAndEnrich(
  url: string,
): Promise<FirecrawlData | null> {
  try {
    const client = getApp();
    if (!client) return null;

    const result = await client.scrapeUrl(url as any);
    // SDK returns { success, data }
    if (!result || (result as any).success === false) return null;
    return (result as any).data as FirecrawlData;
  } catch (err) {
    // Non-fatal: fall back to legacy scraping
    console.error('Firecrawl error:', err);
    return null;
  }
}
