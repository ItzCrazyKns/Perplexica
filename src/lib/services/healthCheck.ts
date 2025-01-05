import axios from 'axios';
import { env } from '../../config/env';
import { supabase } from '../supabase';

export class HealthCheckService {
  static async checkOllama(): Promise<boolean> {
    try {
      const response = await axios.get(`${env.ollama.url}/api/tags`);
      return response.status === 200;
    } catch (error) {
      console.error('Ollama health check failed:', error);
      return false;
    }
  }

  static async checkSearxNG(): Promise<boolean> {
    try {
      const response = await axios.get(`${env.searxng.currentUrl}/config`);
      return response.status === 200;
    } catch (error) {
      try {
        const response = await axios.get(`${env.searxng.instances[0]}/config`);
        return response.status === 200;
      } catch (fallbackError) {
        console.error('SearxNG health check failed:', error);
        return false;
      }
    }
  }

  static async checkSupabase(): Promise<boolean> {
    try {
      console.log('Checking Supabase connection...');
      console.log('URL:', env.supabase.url);

      // Just check if we can connect and query, don't care about results
      const { error } = await supabase
        .from('businesses')
        .select('count', { count: 'planned', head: true });

      if (error) {
        console.error('Supabase query error:', error);
        return false;
      }

      console.log('Supabase connection successful');
      return true;
    } catch (error) {
      console.error('Supabase connection failed:', error);
      return false;
    }
  }
} 