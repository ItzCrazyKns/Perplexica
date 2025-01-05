import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface Config {
  supabase: {
    url: string;
    anonKey: string;
  };
  server: {
    port: number;
    nodeEnv: string;
  };
  search: {
    maxResultsPerQuery: number;
    cacheDurationHours: number;
    searxngUrl?: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  security: {
    corsOrigin: string;
    jwtSecret: string;
  };
  proxy?: {
    http?: string;
    https?: string;
  };
  logging: {
    level: string;
  };
}

const config: Config = {
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  search: {
    maxResultsPerQuery: parseInt(process.env.MAX_RESULTS_PER_QUERY || '20', 10),
    cacheDurationHours: parseInt(process.env.CACHE_DURATION_HOURS || '24', 10),
    searxngUrl: process.env.SEARXNG_URL
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  security: {
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Validate required configuration
const validateConfig = () => {
  if (!config.supabase.url) {
    throw new Error('SUPABASE_URL is required');
  }
  if (!config.supabase.anonKey) {
    throw new Error('SUPABASE_ANON_KEY is required');
  }
};

validateConfig();

export { config }; 