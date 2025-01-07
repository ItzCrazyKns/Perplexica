import axios from 'axios';
import EventEmitter from 'events';
import { Business } from '../types';

interface PartialBusiness {
    name: string;
    address: string;
    phone: string;
    description: string;
    website?: string;
    rating?: number;
}

export class DeepSeekService extends EventEmitter {
    private readonly baseUrl: string;
    private readonly model: string;
    
    constructor() {
        super();
        this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        this.model = process.env.OLLAMA_MODEL || 'deepseek-coder:6.7b';
        console.log('DeepSeekService initialized with:', {
            baseUrl: this.baseUrl,
            model: this.model
        });
    }

    async streamChat(messages: any[], onResult: (business: PartialBusiness) => Promise<void>): Promise<void> {
        try {
            console.log('\nStarting streaming chat request...');
            
            // Enhanced system prompt with more explicit instructions
            const enhancedMessages = [
                {
                    role: "system",
                    content: `You are a business search assistant powered by Deepseek Coder. Your task is to generate sample business listings in JSON format.

When asked about businesses in a location, return business listings one at a time in this exact JSON format:

\`\`\`json
{
    "name": "Example Plumbing Co",
    "address": "123 Main St, Denver, CO 80202",
    "phone": "(303) 555-0123",
    "description": "Licensed plumbing contractor specializing in residential and commercial services",
    "website": "https://exampleplumbing.com",
    "rating": 4.8
}
\`\`\`

Important rules:
1. Return ONE business at a time in JSON format
2. Generate realistic but fictional business data
3. Use proper formatting for phone numbers and addresses
4. Include ratings from 1-5 stars (can use decimals)
5. When sorting by rating, return highest rated first
6. Make each business unique with different names, addresses, and phone numbers
7. Keep descriptions concise and professional
8. Use realistic website URLs based on business names
9. Return exactly the number of businesses requested`
                },
                ...messages
            ];

            console.log('Sending streaming request to Ollama with messages:', JSON.stringify(enhancedMessages, null, 2));

            const response = await axios.post(`${this.baseUrl}/api/chat`, {
                model: this.model,
                messages: enhancedMessages,
                stream: true,
                temperature: 0.7,
                max_tokens: 1000,
                system: "You are a business search assistant that returns one business at a time in JSON format."
            }, {
                responseType: 'stream'
            });

            let currentJson = '';
            response.data.on('data', async (chunk: Buffer) => {
                const text = chunk.toString();
                currentJson += text;

                // Try to find and process complete JSON objects
                try {
                    const business = await this.extractNextBusiness(currentJson);
                    if (business) {
                        currentJson = ''; // Reset for next business
                        await onResult(business);
                    }
                } catch (error) {
                    // Continue collecting more data if JSON is incomplete
                    console.debug('Collecting more data for complete JSON');
                }
            });

            return new Promise((resolve, reject) => {
                response.data.on('end', () => resolve());
                response.data.on('error', (error: Error) => reject(error));
            });

        } catch (error) {
            console.error('\nDeepseek streaming chat error:', error);
            if (error instanceof Error) {
                console.error('Error stack:', error.stack);
                throw new Error(`AI model streaming error: ${error.message}`);
            }
            throw new Error('Failed to get streaming response from AI model');
        }
    }

    private async extractNextBusiness(text: string): Promise<PartialBusiness | null> {
        // Try to find a complete JSON object
        const jsonMatch = text.match(/\{[^{]*\}/);
        if (!jsonMatch) return null;

        try {
            const jsonStr = jsonMatch[0];
            const business = JSON.parse(jsonStr);
            
            // Validate required fields
            if (!business.name || !business.address || !business.phone || !business.description) {
                return null;
            }

            return business;
        } catch (e) {
            return null;
        }
    }

    async chat(messages: any[]): Promise<any> {
        try {
            console.log('\nStarting chat request...');
            
            // Enhanced system prompt with more explicit instructions
            const enhancedMessages = [
                {
                    role: "system",
                    content: `You are a business search assistant powered by Deepseek Coder. Your task is to generate sample business listings in JSON format.

When asked about businesses in a location, return business listings in this exact JSON format, with no additional text or comments:

\`\`\`json
[
    {
        "name": "Example Plumbing Co",
        "address": "123 Main St, Denver, CO 80202",
        "phone": "(303) 555-0123",
        "description": "Licensed plumbing contractor specializing in residential and commercial services",
        "website": "https://exampleplumbing.com",
        "rating": 4.8
    }
]
\`\`\`

Important rules:
1. Return ONLY the JSON array inside code blocks - no explanations or comments
2. Generate realistic but fictional business data
3. Use proper formatting for phone numbers (e.g., "(303) 555-XXXX") and addresses
4. Include ratings from 1-5 stars (can use decimals, e.g., 4.8)
5. When sorting by rating, sort from highest to lowest rating
6. When asked for a specific number of results, always return exactly that many
7. Make each business unique with different names, addresses, and phone numbers
8. Keep descriptions concise and professional
9. Use realistic website URLs based on business names`
                },
                ...messages
            ];

            console.log('Sending request to Ollama with messages:', JSON.stringify(enhancedMessages, null, 2));

            const response = await axios.post(`${this.baseUrl}/api/chat`, {
                model: this.model,
                messages: enhancedMessages,
                stream: false,
                temperature: 0.7,
                max_tokens: 1000,
                system: "You are a business search assistant that always responds with JSON data."
            });

            if (!response.data) {
                throw new Error('Empty response from AI model');
            }

            console.log('\nRaw response data:', JSON.stringify(response.data, null, 2));

            if (!response.data.message?.content) {
                throw new Error('No content in AI model response');
            }

            console.log('\nParsing AI response...');
            const results = await this.sanitizeJsonResponse(response.data.message.content);
            console.log('Parsed results:', JSON.stringify(results, null, 2));
            
            return results;

        } catch (error) {
            console.error('\nDeepseek chat error:', error);
            if (error instanceof Error) {
                console.error('Error stack:', error.stack);
                throw new Error(`AI model error: ${error.message}`);
            }
            throw new Error('Failed to get response from AI model');
        }
    }

    private async sanitizeJsonResponse(text: string): Promise<PartialBusiness[]> {
        console.log('Attempting to parse response:', text);

        // First try to find JSON blocks
        const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
            try {
                const jsonStr = jsonBlockMatch[1].trim();
                console.log('Found JSON block:', jsonStr);
                const parsed = JSON.parse(jsonStr);
                return Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
                console.error('Failed to parse JSON block:', e);
            }
        }

        // Then try to find any JSON-like structure
        const jsonPatterns = [
            /\[\s*\{[\s\S]*\}\s*\]/,  // Array of objects
            /\{[\s\S]*\}/             // Single object
        ];

        for (const pattern of jsonPatterns) {
            const match = text.match(pattern);
            if (match) {
                try {
                    const jsonStr = match[0].trim();
                    console.log('Found JSON pattern:', jsonStr);
                    const parsed = JSON.parse(jsonStr);
                    return Array.isArray(parsed) ? parsed : [parsed];
                } catch (e) {
                    console.error('Failed to parse JSON pattern:', e);
                    continue;
                }
            }
        }

        // If no valid JSON found, try to extract structured data
        try {
            const extractedData = this.extractBusinessData(text);
            if (extractedData) {
                console.log('Extracted business data:', extractedData);
                return [extractedData];
            }
        } catch (e) {
            console.error('Failed to extract business data:', e);
        }

        throw new Error('No valid JSON or business information found in response');
    }

    private extractBusinessData(text: string): PartialBusiness {
        // Extract business information using regex patterns
        const businessInfo: PartialBusiness = {
            name: this.extractField(text, 'name', '[^"\\n]+') || 'Unknown Business',
            address: this.extractField(text, 'address', '[^"\\n]+') || 'Address not available',
            phone: this.extractField(text, 'phone', '[^"\\n]+') || 'Phone not available',
            description: this.extractField(text, 'description', '[^"\\n]+') || 'No description available'
        };

        const website = this.extractField(text, 'website', '[^"\\n]+');
        if (website) {
            businessInfo.website = website;
        }

        const rating = this.extractField(text, 'rating', '[0-9.]+');
        if (rating) {
            businessInfo.rating = parseFloat(rating);
        }

        return businessInfo;
    }

    private extractField(text: string, field: string, pattern: string): string {
        const regex = new RegExp(`"?${field}"?\\s*[:=]\\s*"?(${pattern})"?`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : '';
    }
} 