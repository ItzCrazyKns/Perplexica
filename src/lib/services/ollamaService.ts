import axios from 'axios';
import { env } from '../../config/env';

interface OllamaResponse {
  response: string;
  context?: number[];
}

export class OllamaService {
  private url: string;
  private model: string;

  constructor() {
    this.url = env.ollama.url;
    this.model = env.ollama.model;
  }

  async complete(prompt: string): Promise<string> {
    try {
      const response = await axios.post(`${this.url}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9
        }
      });

      return response.data.response;
    } catch (error) {
      console.error('Ollama completion failed:', error);
      throw error;
    }
  }
} 