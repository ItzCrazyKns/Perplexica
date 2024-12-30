// Dans supabase.ts
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseKey } from '../config';

const supabaseUrl = getSupabaseUrl();
const supabaseKey = getSupabaseKey();

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Fonction de test de connexion
export async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('experts')
      .select('*')
      .limit(1);

    if (error) throw error;
    console.log('✅ Connexion Supabase établie avec succès');
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion Supabase:', error);
    return false;
  }
}