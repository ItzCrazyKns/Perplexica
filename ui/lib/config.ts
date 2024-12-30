// Inspiré de la structure du backend mais adapté pour le frontend
interface Config {
  GENERAL: {
    WS_URL: string;
    API_URL: string;
  };
  SUPABASE: {
    URL: string;
    ANON_KEY: string;
  };
}

// Fonctions utilitaires pour la configuration
export const getSupabaseUrl = (): string => 
  process.env.NEXT_PUBLIC_SUPABASE_URL || '';

export const getSupabaseKey = (): string => 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const getApiUrl = (): string => 
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const getWsUrl = (): string => 
  process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

// Configuration complète
export const config: Config = {
  GENERAL: {
    WS_URL: getWsUrl(),
    API_URL: getApiUrl(),
  },
  SUPABASE: {
    URL: getSupabaseUrl(),
    ANON_KEY: getSupabaseKey(),
  },
};

export default config; 