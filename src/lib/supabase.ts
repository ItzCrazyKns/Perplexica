import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Validate Supabase configuration
if (!env.supabase.url || !env.supabase.anonKey) {
  throw new Error('Missing Supabase configuration');
}

// Create Supabase client
export const supabase = createClient(
  env.supabase.url,
  env.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  }
);

// Test the connection on startup
async function testConnection() {
  try {
    console.log('Checking Supabase connection...');
    console.log('URL:', env.supabase.url);
    
    const { error } = await supabase
      .from('businesses')
      .select('count', { count: 'planned', head: true });

    if (error) {
      console.error('❌ Supabase initialization error:', error);
    } else {
      console.log('✅ Supabase connection initialized successfully');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Supabase:', error);
  }
}

// Run the test
testConnection().catch(console.error); 