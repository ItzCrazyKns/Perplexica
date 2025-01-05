export interface Business {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  rating?: number;
  website?: string;
  logo?: string;
  source: string;
  description?: string;
  location?: {
    lat: number;
    lng: number;
  };
  openingHours?: string[];
  services?: string[];
  reviewCount?: number;
  hours?: string[];
}

export type BusinessData = Business; 