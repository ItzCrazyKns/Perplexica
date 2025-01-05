import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env';
import { BusinessData } from '../types';
import { generateBusinessId, extractPlaceIdFromUrl } from '../utils';

export class DatabaseService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(
            env.supabase.url,
            env.supabase.anonKey,
            {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true
                }
            }
        );
    }

    async searchBusinesses(query: string, location: string): Promise<BusinessData[]> {
        const { data, error } = await this.supabase
            .from('businesses')
            .select('*')
            .textSearch('name', query)
            .textSearch('address', location)
            .order('search_count', { ascending: false })
            .limit(env.cache.maxResultsPerQuery);

        if (error) {
            console.error('Error searching businesses:', error);
            throw error;
        }

        return data || [];
    }

    async saveBusiness(business: Partial<BusinessData>): Promise<void> {
        const id = generateBusinessId({
            title: business.name || '',
            url: business.website,
            phone: business.phone,
            address: business.address
        });

        const { error } = await this.supabase
            .from('businesses')
            .upsert({
                id,
                name: business.name,
                phone: business.phone,
                email: business.email,
                address: business.address,
                rating: business.rating,
                website: business.website,
                logo: business.logo,
                source: business.source,
                description: business.description,
                latitude: business.location?.lat,
                longitude: business.location?.lng,
                place_id: business.website ? extractPlaceIdFromUrl(business.website) : null,
                search_count: 1
            }, {
                onConflict: 'id',
                ignoreDuplicates: false
            });

        if (error) {
            console.error('Error saving business:', error);
            throw error;
        }
    }

    async incrementSearchCount(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('businesses')
            .update({ 
                search_count: this.supabase.rpc('increment'),
                last_updated: new Date().toISOString()
            })
            .eq('id', id);

        if (error) {
            console.error('Error incrementing search count:', error);
            throw error;
        }
    }

    async saveSearch(query: string, location: string, resultsCount: number): Promise<void> {
        const { error } = await this.supabase
            .from('searches')
            .insert([{
                query,
                location,
                results_count: resultsCount,
                timestamp: new Date().toISOString()
            }]);

        if (error) {
            console.error('Error saving search:', error);
            throw error;
        }
    }

    async getFromCache(key: string): Promise<any | null> {
        const { data, error } = await this.supabase
            .from('cache')
            .select('value')
            .eq('key', key)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (error) {
            if (error.code !== 'PGRST116') { // Not found error
                console.error('Error getting from cache:', error);
            }
            return null;
        }

        return data?.value;
    }

    async saveToCache(key: string, value: any, expiresIn: number): Promise<void> {
        const { error } = await this.supabase
            .from('cache')
            .upsert({
                key,
                value,
                expires_at: new Date(Date.now() + expiresIn).toISOString()
            });

        if (error) {
            console.error('Error saving to cache:', error);
            throw error;
        }
    }
}

export const db = new DatabaseService(); 