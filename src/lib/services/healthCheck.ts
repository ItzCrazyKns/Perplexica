import axios from 'axios';
import { supabase } from '../supabase';
import { env } from '../../config/env';

export class HealthCheckService {
  private static async checkSupabase(): Promise<boolean> {
    try {
      const { data, error } = await supabase.from('searches').select('count');
      return !error;
    } catch (error) {
      console.error('Supabase health check failed:', error);
      return false;
    }
  }

  private static async checkSearx(): Promise<boolean> {
    try {
      const response = await axios.get(env.SEARXNG_URL);
      return response.status === 200;
    } catch (error) {
      console.error('SearxNG health check failed:', error);
      return false;
    }
  }

  public static async checkHealth(): Promise<{ 
    supabase: boolean;
    searx: boolean;
  }> {
    const [supabaseHealth, searxHealth] = await Promise.all([
      this.checkSupabase(),
      this.checkSearx()
    ]);

    return {
      supabase: supabaseHealth,
      searx: searxHealth
    };
  }
} 