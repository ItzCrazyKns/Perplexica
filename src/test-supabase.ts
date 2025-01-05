import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testSupabaseConnection() {
    console.log('Testing Supabase connection...');
    console.log('URL:', process.env.SUPABASE_URL);
    console.log('Key length:', process.env.SUPABASE_KEY?.length || 0);

    try {
        const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_KEY!,
            {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true
                }
            }
        );

        // Test businesses table
        console.log('\nTesting businesses table:');
        const testBusiness = {
            id: 'test_' + Date.now(),
            name: 'Test Business',
            phone: '123-456-7890',
            email: 'test@example.com',
            address: '123 Test St',
            rating: 5,
            website: 'https://test.com',
            source: 'test',
            description: 'Test description',
            latitude: 39.7392,
            longitude: -104.9903,
            search_count: 1,
            created_at: new Date().toISOString()
        };

        const { error: insertBusinessError } = await supabase
            .from('businesses')
            .insert([testBusiness])
            .select();

        if (insertBusinessError) {
            console.error('❌ INSERT business error:', insertBusinessError);
        } else {
            console.log('✅ INSERT business OK');
            // Clean up
            await supabase.from('businesses').delete().eq('id', testBusiness.id);
        }

        // Test searches table
        console.log('\nTesting searches table:');
        const testSearch = {
            query: 'test query',
            location: 'test location',
            results_count: 0,
            timestamp: new Date().toISOString()
        };

        const { error: insertSearchError } = await supabase
            .from('searches')
            .insert([testSearch])
            .select();

        if (insertSearchError) {
            console.error('❌ INSERT search error:', insertSearchError);
        } else {
            console.log('✅ INSERT search OK');
        }

        // Test cache table
        console.log('\nTesting cache table:');
        const testCache = {
            key: 'test_key_' + Date.now(),
            value: { test: true },
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3600000).toISOString()
        };

        const { error: insertCacheError } = await supabase
            .from('cache')
            .insert([testCache])
            .select();

        if (insertCacheError) {
            console.error('❌ INSERT cache error:', insertCacheError);
        } else {
            console.log('✅ INSERT cache OK');
            // Clean up
            await supabase.from('cache').delete().eq('key', testCache.key);
        }

    } catch (error: any) {
        console.error('❌ Unexpected error:', error);
    }
}

testSupabaseConnection().catch(console.error); 