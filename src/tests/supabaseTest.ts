import '../config/env';  // Load env vars first
import { CacheService } from '../lib/services/cacheService';
import type { PostgrestError } from '@supabase/supabase-js';
import { env } from '../config/env';

async function testSupabaseConnection() {
  console.log('\n🔍 Testing Supabase Connection...');
  console.log('Using Supabase URL:', env.supabase.url);
  
  try {
    // Test data
    const testData = {
      category: 'test_category',
      location: 'test_location',
      results: [{
        name: 'Test Business',
        phone: '123-456-7890',
        email: 'test@example.com',
        address: '123 Test St, Test City, TS 12345',
        rating: 95,
        website: 'https://test.com',
        logo: '',
        source: 'test',
        description: 'Test business description'
      }]
    };

    console.log('\n1️⃣ Testing write operation...');
    await CacheService.cacheResults(
      testData.category,
      testData.location,
      testData.results,
      env.cache.durationDays
    );
    console.log('✅ Write successful');

    console.log('\n2️⃣ Testing read operation...');
    const cachedResults = await CacheService.getCachedResults(
      testData.category,
      testData.location
    );
    
    if (cachedResults && cachedResults.length > 0) {
      console.log('✅ Read successful');
      console.log('\nCached data:', JSON.stringify(cachedResults[0], null, 2));
    } else {
      throw new Error('No results found in cache');
    }

    console.log('\n3️⃣ Testing update operation...');
    const updatedResults = [...testData.results];
    updatedResults[0].rating = 98;
    await CacheService.updateCache(
      testData.category,
      testData.location,
      updatedResults
    );
    console.log('✅ Update successful');

    console.log('\n✨ All tests passed! Supabase connection is working properly.\n');

  } catch (error: unknown) {
    console.error('\n❌ Test failed:');
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      
      // Check if it's a Supabase error by looking at the shape of the error object
      const isSupabaseError = (err: any): err is PostgrestError => 
        'code' in err && 'details' in err && 'hint' in err && 'message' in err;
      
      if (error.message.includes('connection') || isSupabaseError(error)) {
        console.log('\n📋 Troubleshooting steps:');
        console.log('1. Check if your SUPABASE_URL and SUPABASE_ANON_KEY are correct in .env');
        console.log('2. Verify that the search_cache table exists in your Supabase project');
        console.log('3. Check if RLS policies are properly configured');
        
        if (isSupabaseError(error)) {
          console.log('\nSupabase error details:');
          console.log('Code:', error.code);
          console.log('Details:', error.details);
          console.log('Hint:', error.hint);
        }
      }
    } else {
      console.error('Unknown error:', error);
    }
    
    process.exit(1);
  }
}

// Run the test
testSupabaseConnection(); 