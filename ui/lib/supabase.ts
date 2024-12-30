import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseKey } from '@/lib/config';

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
    console.log('✅ Frontend Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Frontend Supabase connection error:', error);
    return false;
  }
}

export async function uploadExpertImage(file: File, expertId: string) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${expertId}-main.${fileExt}`;
    const filePath = `experts/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('expert-images')  // Créez ce bucket dans Supabase
      .upload(filePath, file, {
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Obtenir l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from('expert-images')
      .getPublicUrl(filePath);

    // Mettre à jour l'expert avec l'URL de l'image
    const { error: updateError } = await supabase
      .from('experts')
      .update({ image_url: publicUrl })
      .eq('id_expert', expertId);

    if (updateError) throw updateError;

    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}
