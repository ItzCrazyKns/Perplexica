import axios from 'axios';
import { env } from '../../config/env';

export class OllamaService {
    private static readonly baseUrl = env.ollama.url;
    private static readonly model = env.ollama.model;

    static async complete(prompt: string): Promise<string> {
        try {
            const response = await axios.post(`${this.baseUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                stream: false
            });

            if (response.data?.response) {
                return response.data.response;
            }

            throw new Error('No response from Ollama');
        } catch (error) {
            console.error('Ollama error:', error);
            throw error;
        }
    }

    static async chat(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
        try {
            const response = await axios.post(`${this.baseUrl}/api/chat`, {
                model: this.model,
                messages: messages,
                stream: false
            });

            if (response.data?.message?.content) {
                return response.data.message.content;
            }

            throw new Error('No response from Ollama chat');
        } catch (error) {
            console.error('Ollama chat error:', error);
            throw error;
        }
    }
} 