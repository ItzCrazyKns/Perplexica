import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Validate Supabase configuration
if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
  throw new Error('Missing Supabase configuration');
}

// Create Supabase client
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);

// Test connection function
export async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    console.log('URL:', env.SUPABASE_URL);
    const { data, error } = await supabase.from('searches').select('count');
    if (error) throw error;
    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Supabase connection failed:', error);
    return false;
  }
} 