export interface Business {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  category: string[];
  rating: number;
  reviewCount: number;
  license?: string;
  services: string[];
  hours: Record<string, string>;
  website?: string;
  email?: string;
  verified: boolean;
  lastUpdated: Date;
}

export interface SearchParams {
  location: string;
  category?: string;
  radius?: number;
  minRating?: number;
  sortBy?: 'rating' | 'distance' | 'reviewCount';
  verified?: boolean;
} 