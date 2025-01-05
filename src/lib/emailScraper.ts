import axios from 'axios';
import * as cheerio from 'cheerio';
import { Cache } from './utils/cache';
import { RateLimiter } from './utils/rateLimiter';
import robotsParser from 'robots-parser';

interface ScrapingResult {
  emails: string[];
  phones: string[];
  addresses: string[];
  socialLinks: string[];
  source: string;
  timestamp: Date;
  attribution: string;
}

export class EmailScraper {
  private cache: Cache<ScrapingResult>;
  private rateLimiter: RateLimiter;
  private robotsCache = new Map<string, any>();

  constructor(private options = { 
    timeout: 5000,
    cacheTTL: 60,
    rateLimit: { windowMs: 60000, maxRequests: 10 }, // More conservative rate limiting
    userAgent: 'BizSearch/1.0 (+https://your-domain.com/about) - Business Directory Service'
  }) {
    this.cache = new Cache<ScrapingResult>(options.cacheTTL);
    this.rateLimiter = new RateLimiter(options.rateLimit.windowMs, options.rateLimit.maxRequests);
  }

  private async checkRobotsPermission(url: string): Promise<boolean> {
    try {
      const { protocol, host } = new URL(url);
      const robotsUrl = `${protocol}//${host}/robots.txt`;
      
      let parser = this.robotsCache.get(host);
      if (!parser) {
        const response = await axios.get(robotsUrl);
        parser = robotsParser(robotsUrl, response.data);
        this.robotsCache.set(host, parser);
      }

      return parser.isAllowed(url, this.options.userAgent);
    } catch (error) {
      console.warn(`Could not check robots.txt for ${url}:`, error);
      return true; // Assume allowed if robots.txt is unavailable
    }
  }

  async scrapeEmails(url: string): Promise<ScrapingResult> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached) return cached;

    // Check robots.txt
    const allowed = await this.checkRobotsPermission(url);
    if (!allowed) {
      console.log(`Respecting robots.txt disallow for ${url}`);
      return {
        emails: [],
        phones: [],
        addresses: [],
        socialLinks: [],
        source: url,
        timestamp: new Date(),
        attribution: 'Restricted by robots.txt'
      };
    }

    // Wait for rate limiting slot
    await this.rateLimiter.waitForSlot();

    try {
      const response = await axios.get(url, {
        timeout: this.options.timeout,
        headers: {
          'User-Agent': this.options.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });

      // Check for noindex meta tag
      const $ = cheerio.load(response.data);
      if ($('meta[name="robots"][content*="noindex"]').length > 0) {
        return {
          emails: [],
          phones: [],
          addresses: [],
          socialLinks: [],
          source: url,
          timestamp: new Date(),
          attribution: 'Respecting noindex directive'
        };
      }

      // Only extract contact information from public contact pages or structured data
      const isContactPage = /contact|about/i.test(url) || 
                          $('h1, h2').text().toLowerCase().includes('contact');

      const result = {
        emails: new Set<string>(),
        phones: new Set<string>(),
        addresses: new Set<string>(),
        socialLinks: new Set<string>(),
        source: url,
        timestamp: new Date(),
        attribution: `Data from public business listing at ${new URL(url).hostname}`
      };

      // Extract from structured data (Schema.org)
      $('script[type="application/ld+json"]').each((_, element) => {
        try {
          const data = JSON.parse($(element).html() || '{}');
          if (data['@type'] === 'LocalBusiness' || data['@type'] === 'Organization') {
            if (data.email) result.emails.add(data.email.toLowerCase());
            if (data.telephone) result.phones.add(this.formatPhoneNumber(data.telephone));
            if (data.address) {
              const fullAddress = this.formatAddress(data.address);
              if (fullAddress) result.addresses.add(fullAddress);
            }
          }
        } catch (e) {
          console.error('Error parsing JSON-LD:', e);
        }
      });

      // Only scrape additional info if it's a contact page
      if (isContactPage) {
        // Extract clearly marked contact information
        $('[itemprop="email"], .contact-email, .email').each((_, element) => {
          const email = $(element).text().trim();
          if (this.isValidEmail(email)) {
            result.emails.add(email.toLowerCase());
          }
        });

        $('[itemprop="telephone"], .phone, .contact-phone').each((_, element) => {
          const phone = $(element).text().trim();
          const formatted = this.formatPhoneNumber(phone);
          if (formatted) result.phones.add(formatted);
        });
      }

      const finalResult = {
        ...result,
        emails: Array.from(result.emails),
        phones: Array.from(result.phones),
        addresses: Array.from(result.addresses),
        socialLinks: Array.from(result.socialLinks)
      };

      this.cache.set(url, finalResult);
      return finalResult;

    } catch (error) {
      console.error(`Failed to scrape ${url}:`, error);
      return {
        emails: [],
        phones: [],
        addresses: [],
        socialLinks: [],
        source: url,
        timestamp: new Date(),
        attribution: 'Error accessing page'
      };
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  }

  private formatPhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    }
    return phone;
  }

  private formatAddress(address: any): string | null {
    if (typeof address === 'string') return address;
    if (typeof address === 'object') {
      const parts = [
        address.streetAddress,
        address.addressLocality,
        address.addressRegion,
        address.postalCode
      ].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
    return null;
  }
} 