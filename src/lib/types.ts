export interface Business {
  id: string;
  name: string;
  address: string;
  phone: string;
  description: string;
  website?: string;
  source: string;
  rating: number;
  location: {
    lat: number;
    lng: number;
  };
}

export type BusinessData = Business; 