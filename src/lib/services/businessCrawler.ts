import axios from 'axios';
import * as cheerio from 'cheerio';
import { Cache } from '../utils/cache';
import { RateLimiter } from '../utils/rateLimiter';

interface CrawlResult {
  mainContent: string;
  contactInfo: string;
  aboutInfo: string;
  structuredData: any;
}

export class BusinessCrawler {
  private cache: Cache<CrawlResult>;
  private rateLimiter: RateLimiter;

  constructor() {
    this.cache = new Cache<CrawlResult>(60); // 1 hour cache
    this.rateLimiter = new RateLimiter();
  }

  async crawlBusinessSite(url: string): Promise<CrawlResult> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached) return cached;

    await this.rateLimiter.waitForSlot();

    try {
      const mainPage = await this.fetchPage(url);
      const $ = cheerio.load(mainPage);
      
      // Get all important URLs
      const contactUrl = this.findContactPage($, url);
      const aboutUrl = this.findAboutPage($, url);

      // Crawl additional pages
      const [contactPage, aboutPage] = await Promise.all([
        contactUrl ? this.fetchPage(contactUrl) : '',
        aboutUrl ? this.fetchPage(aboutUrl) : ''
      ]);

      // Extract structured data
      const structuredData = this.extractStructuredData($);

      const result = {
        mainContent: $('body').text(),
        contactInfo: contactPage,
        aboutInfo: aboutPage,
        structuredData
      };

      this.cache.set(url, result);
      return result;
    } catch (error) {
      console.error(`Failed to crawl ${url}:`, error);
      return {
        mainContent: '',
        contactInfo: '',
        aboutInfo: '',
        structuredData: {}
      };
    }
  }

  private async fetchPage(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BizSearch/1.0; +http://localhost:3000/about)',
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      return '';
    }
  }

  private findContactPage($: cheerio.CheerioAPI, baseUrl: string): string | null {
    const contactLinks = $('a[href*="contact"], a:contains("Contact")');
    if (contactLinks.length > 0) {
      const href = contactLinks.first().attr('href');
      return href ? new URL(href, baseUrl).toString() : null;
    }
    return null;
  }

  private findAboutPage($: cheerio.CheerioAPI, baseUrl: string): string | null {
    const aboutLinks = $('a[href*="about"], a:contains("About")');
    if (aboutLinks.length > 0) {
      const href = aboutLinks.first().attr('href');
      return href ? new URL(href, baseUrl).toString() : null;
    }
    return null;
  }

  private extractStructuredData($: cheerio.CheerioAPI): any {
    const structuredData: any[] = [];
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const data = JSON.parse($(element).html() || '{}');
        structuredData.push(data);
      } catch (error) {
        console.error('Failed to parse structured data:', error);
      }
    });
    return structuredData;
  }
} 