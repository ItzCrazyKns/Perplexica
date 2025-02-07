import axios from 'axios';
import { sleep } from '../utils/helpers';

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export class GeocodingService {
  private static cache = new Map<string, GeocodingResult>();
  private static lastRequestTime = 0;
  private static RATE_LIMIT_MS = 1000; // 1 second between requests (Nominatim requirement)

  static async geocode(address: string): Promise<GeocodingResult | null> {
    // Check cache first
    const cached = this.cache.get(address);
    if (cached) return cached;

    try {
      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.RATE_LIMIT_MS) {
        await sleep(this.RATE_LIMIT_MS - timeSinceLastRequest);
      }
      this.lastRequestTime = Date.now();

      const response = await axios.get(
        'https://nominatim.openstreetmap.org/search',
        {
          params: {
            q: address,
            format: 'json',
            limit: 1,
            addressdetails: 1
          },
          headers: {
            'User-Agent': 'BusinessFinder/1.0'
          }
        }
      );

      if (response.data?.length > 0) {
        const result = response.data[0];
        const geocoded = {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          formattedAddress: result.display_name
        };
        
        // Cache the result
        this.cache.set(address, geocoded);
        return geocoded;
      }
      
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }
} 