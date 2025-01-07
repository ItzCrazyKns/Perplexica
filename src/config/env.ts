import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment configuration
const env = {
    // Supabase Configuration
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_KEY: process.env.SUPABASE_KEY || '',

    // Server Configuration
    PORT: parseInt(process.env.PORT || '3001', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',

    // Search Configuration
    MAX_RESULTS_PER_QUERY: parseInt(process.env.MAX_RESULTS_PER_QUERY || '50', 10),
    CACHE_DURATION_HOURS: parseInt(process.env.CACHE_DURATION_HOURS || '24', 10),
    CACHE_DURATION_DAYS: parseInt(process.env.CACHE_DURATION_DAYS || '7', 10),

    // SearxNG Configuration
    SEARXNG_URL: process.env.SEARXNG_URL || 'http://localhost:4000',

    // Ollama Configuration
    OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'deepseek-coder:6.7b',

    // Hugging Face Configuration
    HUGGING_FACE_API_KEY: process.env.HUGGING_FACE_API_KEY || ''
};

// Validate required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_KEY', 'SEARXNG_URL'];
for (const envVar of requiredEnvVars) {
    if (!env[envVar as keyof typeof env]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

export { env }; 