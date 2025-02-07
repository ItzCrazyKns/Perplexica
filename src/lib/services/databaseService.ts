import { createClient } from '@supabase/supabase-js';
import { Business } from '../types';
import env from '../../config/env';

interface PartialBusiness {
    name: string;
    address: string;
    phone: string;
    description: string;
    website?: string;
    rating?: number;
    source?: string;
    location?: {
        lat: number;
        lng: number;
    };
}

export class DatabaseService {
    private supabase;
    
    constructor() {
        this.supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    }

    async saveBusiness(business: PartialBusiness): Promise<Business> {
        const { data, error } = await this.supabase
            .from('businesses')
            .upsert({
                name: business.name,
                address: business.address,
                phone: business.phone,
                description: business.description,
                website: business.website,
                source: business.source || 'deepseek',
                rating: business.rating || 4.5,
                location: business.location ? `(${business.location.lng},${business.location.lat})` : '(0,0)'
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving business:', error);
            throw new Error('Failed to save business');
        }

        return data;
    }

    async findBusinessesByQuery(query: string, location: string): Promise<Business[]> {
        const { data, error } = await this.supabase
            .from('businesses')
            .select('*')
            .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
            .ilike('address', `%${location}%`)
            .order('rating', { ascending: false });

        if (error) {
            console.error('Error finding businesses:', error);
            throw new Error('Failed to find businesses');
        }

        return data || [];
    }

    async getBusinessById(id: string): Promise<Business | null> {
        const { data, error } = await this.supabase
            .from('businesses')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error getting business:', error);
            return null;
        }

        return data;
    }
} 