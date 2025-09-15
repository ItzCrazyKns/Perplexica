import { getFirecrawlApiKey } from '../config';

interface FirecrawlOptions {
  onlyMainContent?: boolean;
  maxAge?: number;
  parsers?: Array<string>;
  formats?: Array<string>;
}

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown?: string;
    content?: string;
    metadata?: {
      title?: string;
      description?: string;
      url?: string;
    };
  };
  error?: string;
}

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v2/scrape';
const FIRECRAWL_API_KEY = getFirecrawlApiKey();

/**
 * Extract domains from text using regex
 * Matches patterns like: example.com, www.example.com, https://example.com
 */
function extractDomains(text: string): Array<string> {
  const domainRegex =
    /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)(?:[\/\?\#][^\s]*)?/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = domainRegex.exec(text)) !== null) {
    const domain = match[1];
    if (!matches.includes(domain)) {
      matches.push(domain);
    }
  }

  return matches;
}

/**
 * Crawl a single URL using Firecrawl
 */
async function crawlUrl(
  url: string,
  options: FirecrawlOptions = {},
): Promise<FirecrawlResponse> {
  const defaultOptions: FirecrawlOptions = {
    onlyMainContent: true,
    maxAge: 172800000, // 48 hours cache
    parsers: ['pdf'],
    formats: ['markdown'],
    ...options,
  };

  try {
    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: fullUrl,
        ...defaultOptions,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Extract domains from message and crawl them
 * Returns the original message with crawled content appended
 */
async function processMessageWithDomains(message: string): Promise<string> {
  const domains = extractDomains(message);
  if (!domains.length) return message;

  console.log(`Found domains: ${domains.join(', ')}`);

  const results = await Promise.all(
    domains.map(async (domain) => {
      try {
        const result = await crawlUrl(domain);
        if (result.success && result.data?.markdown) {
          const title = result.data.metadata?.title || domain;
          console.log(`Crawled ${domain}`);
          return `\n\n## Crawled Content from ${title} (${domain})\n\n${result.data.markdown}`;
        }
        console.warn(`Failed ${domain}: ${result.error}`);
        return `\n\n## Note: Unable to crawl ${domain}\n\nReason: ${result.error}`;
      } catch (e) {
        console.error(`Error crawling ${domain}:`, e);
        return `\n\n## Note: Error crawling ${domain}\n\nAn unexpected error occurred while trying to crawl this domain.`;
      }
    }),
  );

  const processed = results.length
    ? `${message}\n\n---\n\n**Additional Context from Web Pages:**${results.join('')}`
    : message;

  return processed;
}

export {
  extractDomains,
  crawlUrl,
  processMessageWithDomains,
  type FirecrawlOptions,
  type FirecrawlResponse,
};
