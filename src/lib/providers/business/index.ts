import { Business, SearchParams } from '../../../types/business';
import { WebScraperProvider } from './webScraper';

export class BusinessProvider {
  private scraper: WebScraperProvider;

  constructor() {
    this.scraper = new WebScraperProvider();
  }

  async search(params: SearchParams): Promise<Business[]> {
    return this.scraper.search(params);
  }

  async getDetails(businessId: string): Promise<Business | null> {
    // Implement detailed business lookup using stored data or additional scraping
    return null;
  }
} 