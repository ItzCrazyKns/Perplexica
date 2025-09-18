import { FirecrawlApp } from '@mendable/firecrawl-js';

async function main() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error('Missing FIRECRAWL_API_KEY in environment');
    process.exit(1);
  }

  const url = process.argv[2] || 'https://techcrunch.com';
  const app = new FirecrawlApp({ apiKey });

  try {
    const res = await app.scrapeUrl(url, { enrich: true });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('Firecrawl scrape failed:', err);
    process.exit(1);
  }
}

main();
