import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env';
import { BusinessData } from '../searxng';

export class SupabaseService {
  private supabase;

  constructor() {
    this.supabase = createClient(env.supabase.url, env.supabase.anonKey);
  }

  async upsertBusinesses(businesses: BusinessData[]): Promise<void> {
    try {
      console.log('Upserting businesses to Supabase:', businesses.length);

      for (const business of businesses) {
        try {
          // Create a unique identifier based on multiple properties
          const identifier = [
            business.name.toLowerCase(),
            business.phone?.replace(/\D/g, ''),
            business.address?.toLowerCase(),
            business.website?.toLowerCase()
          ]
            .filter(Boolean)  // Remove empty values
            .join('_')       // Join with underscore
            .replace(/[^a-z0-9]/g, '_');  // Replace non-alphanumeric chars

          // Log the data being inserted
          console.log('Upserting business:', {
            id: identifier,
            name: business.name,
            phone: business.phone,
            email: business.email,
            address: business.address,
            rating: business.rating,
            website: business.website,
            location: business.location
          });

          // Check if business exists
          const { data: existing, error: selectError } = await this.supabase
            .from('businesses')
            .select('rating, search_count')
            .eq('id', identifier)
            .single();

          if (selectError && selectError.code !== 'PGRST116') {
            console.error('Error checking existing business:', selectError);
          }

          // Prepare upsert data
          const upsertData = {
            id: identifier,
            name: business.name,
            phone: business.phone || null,
            email: business.email || null,
            address: business.address || null,
            rating: existing ? Math.max(business.rating, existing.rating) : business.rating,
            website: business.website || null,
            logo: business.logo || null,
            source: business.source || null,
            description: business.description || null,
            latitude: business.location?.lat || null,
            longitude: business.location?.lng || null,
            last_updated: new Date().toISOString(),
            search_count: existing ? existing.search_count + 1 : 1
          };

          console.log('Upserting with data:', upsertData);

          const { error: upsertError } = await this.supabase
            .from('businesses')
            .upsert(upsertData, {
              onConflict: 'id'
            });

          if (upsertError) {
            console.error('Error upserting business:', upsertError);
            console.error('Failed business data:', upsertData);
          } else {
            console.log(`Successfully upserted business: ${business.name}`);
          }
        } catch (businessError) {
          console.error('Error processing business:', business.name, businessError);
        }
      }
    } catch (error) {
      console.error('Error saving businesses to Supabase:', error);
      throw error;
    }
  }
} 