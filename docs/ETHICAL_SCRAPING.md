# Ethical Web Scraping Guidelines

## Core Principles

1. **Respect Robots.txt**
   - Always check and honor robots.txt directives
   - Cache robots.txt to reduce server load
   - Default to conservative behavior when uncertain

2. **Proper Identification**
   - Use clear, identifiable User-Agent strings
   - Provide contact information
   - Be transparent about your purpose

3. **Rate Limiting**
   - Implement conservative rate limits
   - Use exponential backoff for errors
   - Distribute requests over time

4. **Data Usage**
   - Only collect publicly available business information
   - Respect privacy and data protection laws
   - Provide clear opt-out mechanisms
   - Keep data accurate and up-to-date

5. **Technical Considerations**
   - Cache results to minimize requests
   - Handle errors gracefully
   - Monitor and log access patterns
   - Use structured data when available

## Implementation

1. **Request Headers**
```typescript
const headers = {
  'User-Agent': 'BizSearch/1.0 (+https://bizsearch.com/about)',
  'Accept': 'text/html,application/xhtml+xml',
  'From': 'contact@bizsearch.com'
};
```

2. **Rate Limiting**
```typescript
const rateLimits = {
  requestsPerMinute: 10,
  requestsPerHour: 100,
  requestsPerDomain: 20
};
```

3. **Caching**
```typescript
const cacheSettings = {
  ttl: 24 * 60 * 60, // 24 hours
  maxSize: 1000 // entries
};
```

## Opt-Out Process

1. Business owners can opt-out by:
   - Submitting a form on our website
   - Emailing opt-out@bizsearch.com
   - Adding a meta tag: `<meta name="bizsearch" content="noindex">`

2. We honor opt-outs within:
   - 24 hours for direct requests
   - 72 hours for cached data

## Legal Compliance

1. **Data Protection**
   - GDPR compliance for EU businesses
   - CCPA compliance for California businesses
   - Regular data audits and cleanup

2. **Attribution**
   - Clear source attribution
   - Last-updated timestamps
   - Data accuracy disclaimers

## Best Practices

1. **Before Scraping**
   - Check robots.txt
   - Verify site status
   - Review terms of service
   - Look for API alternatives

2. **During Scraping**
   - Monitor response codes
   - Respect server hints
   - Implement backoff strategies
   - Log access patterns

3. **After Scraping**
   - Verify data accuracy
   - Update cache entries
   - Clean up old data
   - Monitor opt-out requests

## Contact

For questions or concerns about our scraping practices:
- Email: ethics@bizsearch.com
- Phone: (555) 123-4567
- Web: https://bizsearch.com/ethics 