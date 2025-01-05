export interface BusinessData {
    id?: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    rating?: number;
    website?: string;
    logo?: string;
    source?: string;
    description?: string;
    location?: {
        lat: number;
        lng: number;
    };
    latitude?: number;
    longitude?: number;
    place_id?: string;
    photos?: string[];
    openingHours?: string[];
    distance?: {
        value: number;
        unit: string;
    };
    last_updated?: string;
    search_count?: number;
    created_at?: string;
} 