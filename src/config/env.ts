import { config } from 'dotenv';
import { z } from 'zod';

config();

// Define the environment schema
const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.string().default('development'),
  SUPABASE_URL: z.string(),
  SUPABASE_KEY: z.string(),
  OLLAMA_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama2'),
  SEARXNG_URL: z.string().default('http://localhost:4000'),
  SEARXNG_INSTANCES: z.string().default('["http://localhost:4000"]'),
  MAX_RESULTS_PER_QUERY: z.string().default('50'),
  CACHE_DURATION_HOURS: z.string().default('24'),
  CACHE_DURATION_DAYS: z.string().default('7'),
  HUGGING_FACE_API_KEY: z.string({
    required_error: "HUGGING_FACE_API_KEY is required in .env"
  })
});

// Define the final environment type
export interface EnvConfig {
  PORT: string;
  NODE_ENV: string;
  searxng: {
    currentUrl: string;
    instances: string[];
  };
  ollama: {
    url: string;
    model: string;
  };
  supabase: {
    url: string;
    anonKey: string;
  };
  cache: {
    maxResultsPerQuery: number;
    durationHours: number;
    durationDays: number;
  };
  ai: {
    model: string;
    temperature: number;
    maxTokens: number;
    batchSize: number;
  };
  huggingface: {
    apiKey: string;
  };
}

// Parse and transform the environment variables
const rawEnv = envSchema.parse(process.env);

// Create the final environment object with parsed configurations
export const env: EnvConfig = {
  PORT: rawEnv.PORT,
  NODE_ENV: rawEnv.NODE_ENV,
  searxng: {
    currentUrl: rawEnv.SEARXNG_URL,
    instances: JSON.parse(rawEnv.SEARXNG_INSTANCES)
  },
  ollama: {
    url: rawEnv.OLLAMA_URL,
    model: rawEnv.OLLAMA_MODEL
  },
  supabase: {
    url: rawEnv.SUPABASE_URL,
    anonKey: rawEnv.SUPABASE_KEY
  },
  cache: {
    maxResultsPerQuery: parseInt(rawEnv.MAX_RESULTS_PER_QUERY),
    durationHours: parseInt(rawEnv.CACHE_DURATION_HOURS),
    durationDays: parseInt(rawEnv.CACHE_DURATION_DAYS)
  },
  ai: {
    model: 'deepseek-ai/deepseek-coder-6.7b-instruct',
    temperature: 0.7,
    maxTokens: 512,
    batchSize: 3
  },
  huggingface: {
    apiKey: rawEnv.HUGGING_FACE_API_KEY
  }
}; 