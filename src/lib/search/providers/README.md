# Search Provider System

This directory contains the pluggable search provider architecture for Perplexica, allowing you to switch between different search engines.

## Available Providers

### 1. SearxNG (Default)
Open-source metasearch engine that aggregates results from multiple sources while preserving privacy.

**Pros:**
- Free and open source
- Privacy-focused (no tracking)
- Aggregates multiple search engines
- No API limits or costs
- Supports specialized searches (images, videos, news, etc.)

**Cons:**
- Requires running your own SearxNG instance
- Results quality depends on configured engines

**Configuration:**
```toml
[SEARCH]
PROVIDER = "searxng"

[SEARCH.SEARXNG]
API_URL = "http://localhost:32768"  # or http://searxng:8080 in Docker
```

### 2. Google Custom Search Engine
Google's programmable search API with customizable result filtering.

**Pros:**
- High-quality, relevant results
- Excellent for specific domain searches
- Reliable and fast
- Good for production use cases

**Cons:**
- Requires Google Cloud account
- Limited free tier (100 queries/day)
- Paid after free tier ($5 per 1000 queries)
- Less privacy-focused

**Configuration:**
1. Create a Custom Search Engine at https://programmablesearchengine.google.com/
2. Get API key from https://developers.google.com/custom-search/v1/overview
3. Configure in `config.toml`:

```toml
[SEARCH]
PROVIDER = "google_custom_search"

[SEARCH.GOOGLE_CUSTOM_SEARCH]
API_KEY = "your-google-api-key"
CX = "your-search-engine-id"
```

## Usage

### Basic Search

```typescript
import { search } from '@/lib/search/providers';

const results = await search('your query', {
  language: 'en',
  engines: ['google', 'bing'],  // Provider-specific
  pageno: 1
});

console.log(results.results);  // Array of search results
console.log(results.suggestions);  // Query suggestions
```

### Result Format

All providers return results in a consistent format:

```typescript
interface SearchResponse {
  results: SearchResult[];
  suggestions: string[];
}

interface SearchResult {
  title: string;
  url: string;
  content?: string;
  img_src?: string;  // For image results
  thumbnail_src?: string;
  iframe_src?: string;  // For video results
}
```

## Adding a New Provider

To add support for a new search engine:

1. **Create provider class** in `src/lib/search/providers/yourprovider.ts`:

```typescript
import type { SearchProvider, SearchOptions, SearchResponse } from './types';

export class YourProvider implements SearchProvider {
  async search(query: string, opts?: SearchOptions): Promise<SearchResponse> {
    // Implement your search logic
    return {
      results: [...],
      suggestions: [...]
    };
  }
}
```

2. **Register in factory** (`src/lib/search/providers/index.ts`):

```typescript
import { YourProvider } from './yourprovider';

case 'your_provider':
  searchProviderInstance = new YourProvider();
  break;
```

3. **Add config getters** in `src/lib/config.ts`:

```typescript
export const getYourProviderApiKey = () => {
  const config = loadConfig();
  return config.SEARCH?.YOUR_PROVIDER?.API_KEY || '';
};
```

4. **Update config schema** in `src/lib/config.ts` and `sample.config.toml`.

## Provider Comparison

| Feature | SearxNG | Google Custom Search |
|---------|---------|---------------------|
| Cost | Free | Free tier: 100/day, then $5/1000 |
| Privacy | Excellent | Moderate |
| Result Quality | Good | Excellent |
| Setup Complexity | Medium | Easy |
| API Limits | None | Yes |
| Image Search | Yes | Yes |
| Video Search | Yes | Limited |
| News Search | Yes | Yes |
| Custom Filtering | Engine-based | Site-based |

## Migration from Old System

The old `searxng.ts` file is maintained for backward compatibility but is deprecated. Update your imports:

**Old:**
```typescript
import { searchSearxng } from '@/lib/searxng';
```

**New:**
```typescript
import { search } from '@/lib/search/providers';
```

The API is identical, but the new system automatically uses your configured provider.

## Troubleshooting

### SearxNG Connection Errors
- Verify SearxNG is running and accessible
- Check `API_URL` in config matches your SearxNG instance
- In Docker: use `http://searxng:8080`
- Locally: typically `http://localhost:32768`

### Google Custom Search Errors
- **"Invalid API key"**: Check your API key in Google Cloud Console
- **"Quota exceeded"**: You've hit the daily limit (100 free queries)
- **"Invalid CX"**: Verify your Search Engine ID from the CSE control panel

### No Results Returned
- Check provider is configured correctly in `config.toml`
- Verify API credentials are valid
- Check network connectivity to the search service
- Review application logs for detailed error messages
