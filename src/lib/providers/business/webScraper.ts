import { Business, SearchParams } from '../../../types/business';
import { searchWeb } from '../search'; // This is Perplexica's existing search function
import { parseHTML } from '../utils/parser';

export class WebScraperProvider {
  async search(params: SearchParams): Promise<Business[]> {
    const searchQueries = this.generateQueries(params);
    const businesses: Business[] = [];

    for (const query of searchQueries) {
      // Use Perplexica's existing search functionality
      const results = await searchWeb(query, {
        maxResults: 20,
        type: 'general'  // or 'news' depending on what we want
      });

      for (const result of results) {
        try {
          const html = await fetch(result.url).then(res => res.text());
          const businessData = await this.extractBusinessData(html, result.url);
          if (businessData) {
            businesses.push(businessData);
          }
        } catch (error) {
          console.error(`Failed to extract data from ${result.url}:`, error);
        }
      }
    }

    return this.deduplicateBusinesses(businesses);
  }

  private generateQueries(params: SearchParams): string[] {
    const { location, category } = params;
    return [
      `${category} in ${location}`,
      `${category} business ${location}`,
      `best ${category} near ${location}`,
      `${category} services ${location} reviews`
    ];
  }

  private async extractBusinessData(html: string, sourceUrl: string): Promise<Business | null> {
    const $ = parseHTML(html);
    
    // Different extraction logic based on source
    if (sourceUrl.includes('yelp.com')) {
      return this.extractYelpData($);
    } else if (sourceUrl.includes('yellowpages.com')) {
      return this.extractYellowPagesData($);
    }
    // ... other source-specific extractors

    return null;
  }

  private extractYelpData($: any): Business | null {
    try {
      return {
        id: crypto.randomUUID(),
        name: $('.business-name').text().trim(),
        phone: $('.phone-number').text().trim(),
        address: $('.address').text().trim(),
        city: $('.city').text().trim(),
        state: $('.state').text().trim(),
        zip: $('.zip').text().trim(),
        category: $('.category-str-list').text().split(',').map(s => s.trim()),
        rating: parseFloat($('.rating').text()),
        reviewCount: parseInt($('.review-count').text()),
        services: $('.services-list').text().split(',').map(s => s.trim()),
        hours: this.extractHours($),
        website: $('.website-link').attr('href'),
        verified: false,
        lastUpdated: new Date()
      };
    } catch (error) {
      return null;
    }
  }

  private deduplicateBusinesses(businesses: Business[]): Business[] {
    // Group by phone number and address to identify duplicates
    const uniqueBusinesses = new Map<string, Business>();
    
    for (const business of businesses) {
      const key = `${business.phone}-${business.address}`.toLowerCase();
      if (!uniqueBusinesses.has(key)) {
        uniqueBusinesses.set(key, business);
      } else {
        // Merge data if we have additional information
        const existing = uniqueBusinesses.get(key)!;
        uniqueBusinesses.set(key, this.mergeBusinessData(existing, business));
      }
    }

    return Array.from(uniqueBusinesses.values());
  }

  private mergeBusinessData(existing: Business, newData: Business): Business {
    return {
      ...existing,
      services: [...new Set([...existing.services, ...newData.services])],
      rating: (existing.rating + newData.rating) / 2,
      reviewCount: existing.reviewCount + newData.reviewCount,
      // Keep the most complete data for other fields
      website: existing.website || newData.website,
      email: existing.email || newData.email,
      hours: existing.hours || newData.hours
    };
  }
} 