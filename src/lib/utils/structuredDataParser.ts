import * as cheerio from 'cheerio';

interface StructuredData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  socialProfiles?: string[];
  openingHours?: Record<string, string>;
  description?: string;
}

export class StructuredDataParser {
  static parse($: cheerio.CheerioAPI): StructuredData[] {
    const results: StructuredData[] = [];

    // Parse JSON-LD
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const data = JSON.parse($(element).html() || '{}');
        if (Array.isArray(data)) {
          data.forEach(item => this.parseStructuredItem(item, results));
        } else {
          this.parseStructuredItem(data, results);
        }
      } catch (e) {
        console.error('Error parsing JSON-LD:', e);
      }
    });

    // Parse microdata
    $('[itemtype]').each((_, element) => {
      const type = $(element).attr('itemtype');
      if (type?.includes('Organization') || type?.includes('LocalBusiness')) {
        const data: StructuredData = {
          name: $('[itemprop="name"]', element).text(),
          email: $('[itemprop="email"]', element).text(),
          phone: $('[itemprop="telephone"]', element).text(),
          address: this.extractMicrodataAddress($, element),
          socialProfiles: this.extractSocialProfiles($, element)
        };
        results.push(data);
      }
    });

    // Parse RDFa
    $('[typeof="Organization"], [typeof="LocalBusiness"]').each((_, element) => {
      const data: StructuredData = {
        name: $('[property="name"]', element).text(),
        email: $('[property="email"]', element).text(),
        phone: $('[property="telephone"]', element).text(),
        address: this.extractRdfaAddress($, element),
        socialProfiles: this.extractSocialProfiles($, element)
      };
      results.push(data);
    });

    return results;
  }

  private static parseStructuredItem(data: any, results: StructuredData[]): void {
    if (data['@type'] === 'Organization' || data['@type'] === 'LocalBusiness') {
      results.push({
        name: data.name,
        email: data.email,
        phone: data.telephone,
        address: this.formatAddress(data.address),
        socialProfiles: this.extractSocialUrls(data),
        openingHours: this.parseOpeningHours(data.openingHours),
        description: data.description
      });
    }
  }

  private static formatAddress(address: any): string | undefined {
    if (typeof address === 'string') return address;
    if (typeof address === 'object') {
      const parts = [
        address.streetAddress,
        address.addressLocality,
        address.addressRegion,
        address.postalCode,
        address.addressCountry
      ].filter(Boolean);
      return parts.join(', ');
    }
    return undefined;
  }

  private static extractSocialUrls(data: any): string[] {
    const urls: string[] = [];
    if (data.sameAs) {
      if (Array.isArray(data.sameAs)) {
        urls.push(...data.sameAs);
      } else if (typeof data.sameAs === 'string') {
        urls.push(data.sameAs);
      }
    }
    return urls;
  }

  private static parseOpeningHours(hours: any): Record<string, string> | undefined {
    if (!hours) return undefined;
    
    if (Array.isArray(hours)) {
      const schedule: Record<string, string> = {};
      hours.forEach(spec => {
        const match = spec.match(/^(\w+)(-\w+)?\s+(\d\d:\d\d)-(\d\d:\d\d)$/);
        if (match) {
          schedule[match[1]] = `${match[3]}-${match[4]}`;
        }
      });
      return schedule;
    }
    return undefined;
  }

  // ... helper methods for microdata and RDFa parsing ...
} 