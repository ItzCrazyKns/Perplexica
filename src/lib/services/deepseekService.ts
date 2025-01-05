import axios from 'axios';
import { env } from '../../config/env';
import { Business } from '../types';

export class DeepSeekService {
    private static OLLAMA_URL = 'http://localhost:11434/api/generate';
    private static MODEL_NAME = 'qwen2:0.5b';
    private static MAX_ATTEMPTS = 3;  // Prevent infinite loops
    
    private static async retryWithBackoff(fn: () => Promise<any>, retries = 5) {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === retries - 1) throw error;
                
                // Longer backoff for timeouts
                const isTimeout = axios.isAxiosError(error) && error.code === 'ECONNABORTED';
                const delay = isTimeout ? 
                    Math.pow(2, i) * 5000 :  // 5s, 10s, 20s, 40s, 80s for timeouts
                    Math.pow(2, i) * 1000;   // 1s, 2s, 4s, 8s, 16s for other errors
                
                console.log(`Retry ${i + 1}/${retries} after ${delay/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    private static cleanAddress(address: string): string {
        // Remove marketing and extra info first
        let cleaned = address
            .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]/gu, '')  // Remove emojis
            .replace(/(?:GET|ORDER|SCHEDULE|CONTACT|DIRECTIONS).*?[:!\n]/i, '')  // Remove action words
            .replace(/\([^)]*\)/g, '')  // Remove parenthetical info
            .replace(/(?:Next|Behind|Inside|Near).*$/im, '')  // Remove location hints
            .split(/[\n\r]+/)  // Split into lines
            .map(line => line.trim())
            .filter(Boolean);  // Remove empty lines

        // Try to find the line with street address
        for (const line of cleaned) {
            // Common address patterns
            const patterns = [
                // Handle suite/unit in street address
                /(\d+[^,]+?(?:\s+(?:Suite|Ste|Unit|Apt|Building|Bldg|#)\s*[-A-Z0-9]+)?),\s*([^,]+?),\s*(?:CO|Colorado|COLORADO)[,\s]+(\d{5})/i,
                
                // Basic format
                /(\d+[^,]+?),\s*([^,]+?),\s*(?:CO|Colorado|COLORADO)[,\s]+(\d{5})/i,
                
                // No commas
                /(\d+[^,]+?)\s+([^,]+?)\s+(?:CO|Colorado|COLORADO)\s+(\d{5})/i,
            ];

            for (const pattern of patterns) {
                const match = line.match(pattern);
                if (match) {
                    const [_, street, city, zip] = match;
                    
                    // Clean and capitalize street address
                    const cleanedStreet = street
                        .replace(/\s+/g, ' ')
                        .replace(/(\d+)/, '$1 ')  // Add space after number
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');
                    
                    // Capitalize city
                    const cleanedCity = city.trim()
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');
                    
                    return `${cleanedStreet}, ${cleanedCity}, CO ${zip}`;
                }
            }
        }

        // If no match found, try to extract components
        const streetLine = cleaned.find(line => /\d+/.test(line));
        if (streetLine) {
            const streetMatch = streetLine.match(/(\d+[^,\n]+?)(?:\s+(?:Suite|Ste|Unit|Apt|Building|Bldg|#)\s*[-A-Z0-9]+)?/i);
            const zipMatch = cleaned.join(' ').match(/\b(\d{5})\b/);
            
            if (streetMatch && zipMatch) {
                const street = streetMatch[0].trim();
                const zip = zipMatch[1];
                
                return `${street}, Denver, CO ${zip}`;
            }
        }

        return '';
    }

    private static manualClean(business: Partial<Business>): Partial<Business> {
        const cleaned = { ...business };

        // Clean address
        if (cleaned.address) {
            const cleanedAddress = this.cleanAddress(cleaned.address);
            if (cleanedAddress) {
                cleaned.address = cleanedAddress;
            }
        }

        // Extract business type first
        const businessType = this.detectBusinessType(cleaned.name || '');

        // Clean name while preserving core identity
        if (cleaned.name) {
            cleaned.name = cleaned.name
                // Remove emojis and special characters
                .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]/gu, '')
                // Remove bracketed content but preserve important terms
                .replace(/\s*[\[\({](?!(?:BMW|Mercedes|Audi|specialist|certified)).*?[\]\)}]\s*/gi, ' ')
                // Remove business suffixes
                .replace(/\b(?:LLC|Inc|Corp|Ltd|DBA|Est\.|Since|P\.?C\.?)\b\.?\s*\d*/gi, '')
                // Clean up and normalize
                .replace(/[^\w\s&'-]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/^THE\s+/i, ''); // Remove leading "THE"
        }

        // Clean phone - handle multiple numbers and formats
        if (cleaned.phone) {
            // Remove emojis and special characters first
            const cleanPhone = cleaned.phone
                .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]/gu, '')
                .replace(/[^\d]/g, '');
            
            const phoneNumbers = cleanPhone.match(/\d{10,}/g);
            if (phoneNumbers?.[0]) {
                const mainNumber = phoneNumbers[0].slice(0, 10);  // Ensure exactly 10 digits
                cleaned.phone = `(${mainNumber.slice(0,3)}) ${mainNumber.slice(3,6)}-${mainNumber.slice(6,10)}`;
            }
        }

        // Clean email - handle multiple emails and formats
        if (cleaned.email) {
            const emailMatch = cleaned.email.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (emailMatch?.[1]) {
                cleaned.email = emailMatch[1];
            }
        }

        // Improved description cleaning
        if (cleaned.description) {
            const coreDescription = this.extractCoreDescription(cleaned.description, businessType);
            cleaned.description = coreDescription;
        }

        return cleaned;
    }

    private static detectBusinessType(name: string): string {
        const types = {
            auto: /\b(?:auto|car|vehicle|BMW|Audi|Mercedes|mechanic|repair|service center)\b/i,
            dental: /\b(?:dental|dentist|orthodontic|smile|tooth|teeth)\b/i,
            coffee: /\b(?:coffee|cafe|espresso|roaster|brew)\b/i,
            plumbing: /\b(?:plumb|plumbing|rooter|drain|pipe)\b/i,
            restaurant: /\b(?:restaurant|grill|cuisine|bistro|kitchen)\b/i,
        };

        for (const [type, pattern] of Object.entries(types)) {
            if (pattern.test(name)) return type;
        }
        return 'business';
    }

    private static extractCoreDescription(description: string, businessType: string): string {
        // Remove all marketing and formatting first
        let cleaned = description
            .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]/gu, '')
            .replace(/\$+\s*[^\s]*\s*(off|special|offer|deal|save|discount|price|cost|free)/gi, '')
            .replace(/\b(?:call|email|visit|contact|text|www\.|http|@|book|schedule|appointment)\b.*$/gi, '')
            .replace(/#\w+/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Extract relevant information based on business type
        const typePatterns: { [key: string]: RegExp[] } = {
            auto: [
                /(?:specialist|specializing)\s+in\s+[^.]+/i,
                /(?:certified|ASE)[^.]+mechanic[^.]+/i,
                /(?:auto|car|vehicle)\s+(?:service|repair)[^.]+/i
            ],
            dental: [
                /(?:dental|orthodontic)\s+(?:care|services)[^.]+/i,
                /(?:family|cosmetic|general)\s+dentistry[^.]+/i,
                /state-of-the-art\s+facility[^.]+/i
            ],
            coffee: [
                /(?:coffee|espresso|pastry|cafe)[^.]+/i,
                /(?:organic|fair-trade|fresh)[^.]+/i,
                /(?:local|favorite|community)[^.]+coffee[^.]+/i
            ],
            plumbing: [
                /(?:plumbing|drain|pipe)\s+(?:service|repair)[^.]+/i,
                /(?:professional|expert|master)\s+plumb[^.]+/i,
                /(?:residential|commercial)\s+plumbing[^.]+/i
            ]
        };

        const relevantPhrases = typePatterns[businessType]?.map(pattern => {
            const match = cleaned.match(pattern);
            return match ? match[0] : '';
        }).filter(Boolean) || [];

        if (relevantPhrases.length > 0) {
            return relevantPhrases.join('. ');
        }

        // Fallback to generic description
        return `Professional ${businessType} services in Denver area`;
    }

    private static sanitizeJsonResponse(response: string): string {
        return response
            // Remove emojis
            .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]/gu, '')
            // Remove control characters
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            // Clean up newlines and spaces
            .replace(/\r?\n\s*/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    static async cleanBusinessData(business: Business, attempt = 0): Promise<Business> {
        if (attempt >= this.MAX_ATTEMPTS) {
            console.log('Max cleaning attempts reached, applying manual cleaning...');
            return {
                ...business,
                ...this.manualClean(business)
            };
        }

        // Detect business type first
        const businessType = this.detectBusinessType(business.name || '');

        const requestId = Math.random().toString(36).substring(7);
        const prompt = `<|im_start|>system
You are a data cleaning expert. Clean the business data while preserving its core identity and type.
Request ID: ${requestId}  // Force uniqueness
IMPORTANT: Return ONLY plain text without emojis or special characters.
<|im_end|>
<|im_start|>user
Clean this ${businessType} business data by following these rules exactly:

Input Business:
${JSON.stringify(business, null, 2)}

Cleaning Rules:
1. NAME: Remove brackets/braces but preserve core business identity
2. ADDRESS: Format as "street, city, state zip" using state abbreviations
3. PHONE: Extract and format primary phone as "(XXX) XXX-XXXX"
4. EMAIL: Remove markdown/mailto formatting but keep actual email
5. DESCRIPTION: Keep core business info but remove:
   - ALL emojis and special characters (return plain text only)
   - Prices and special offers
   - Contact information
   - Marketing language
   - Social media elements

Return ONLY clean JSON with the original business identity preserved:
{
  "business_info": {
    "name": "Keep original business name without formatting",
    "address": "Keep original address, properly formatted",
    "phone": "Keep original phone number, properly formatted",
    "email": "Keep original email without formatting",
    "description": "Keep original business description without marketing"
  }
}
<|im_end|>`;

        const response = await this.chat([{
            role: 'user',
            content: prompt
        }]);

        try {
            const jsonMatch = response.match(/\{[\s\S]*?\}\s*$/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            
            const sanitizedJson = this.sanitizeJsonResponse(jsonMatch[0]);
            const parsed = JSON.parse(sanitizedJson);
            const cleaned = {
                ...business,
                ...parsed.business_info
            };

            // Validate and handle type mismatches more strictly
            const validationIssues = this.validateCleanedData(cleaned, business);
            
            if (validationIssues.length > 0) {
                console.log(`Attempt ${attempt + 1}: Validation issues:`, validationIssues.join(', '));
                
                // If there's a business type mismatch, go straight to manual cleaning
                if (validationIssues.some(issue => issue.includes('Business type mismatch'))) {
                    console.log('Business type mismatch detected, applying manual cleaning...');
                    return {
                        ...business,
                        ...this.manualClean(business)
                    };
                }
                
                // For other validation issues, try again
                return this.cleanBusinessData(cleaned, attempt + 1);
            }

            return cleaned;
        } catch (error) {
            console.error('Failed to parse response:', error);
            console.log('Raw response:', response);
            
            // Try to sanitize and parse the whole response
            try {
                const sanitized = this.sanitizeJsonResponse(response);
                const fallback = this.parseResponse(sanitized);
                return this.cleanBusinessData({ ...business, ...fallback }, attempt + 1);
            } catch (parseError) {
                console.error('Failed to parse sanitized response:', parseError);
                return this.cleanBusinessData({ ...business, ...this.manualClean(business) }, attempt + 1);
            }
        }
    }

    private static validateCleanedData(business: Partial<Business>, originalBusiness: Business): string[] {
        const issues: string[] = [];
        
        // Stricter business type validation
        const originalType = this.detectBusinessType(originalBusiness.name || '');
        const cleanedType = this.detectBusinessType(business.name || '');
        
        if (originalType !== 'business') {
            if (cleanedType !== originalType) {
                issues.push(`Business type mismatch: expected ${originalType}, got ${cleanedType}`);
            }
            
            // Verify core identity is preserved
            const originalKeywords = originalBusiness.name?.toLowerCase().split(/\W+/).filter(Boolean) || [];
            const cleanedKeywords = business.name?.toLowerCase().split(/\W+/).filter(Boolean) || [];
            
            const significantKeywords = originalKeywords.filter(word => 
                !['the', 'and', 'llc', 'inc', 'corp', 'ltd', 'dba', 'est'].includes(word)
            );
            
            const missingKeywords = significantKeywords.filter(word => 
                !cleanedKeywords.some(cleaned => cleaned.includes(word))
            );
            
            if (missingKeywords.length > 0) {
                issues.push(`Core business identity lost: missing ${missingKeywords.join(', ')}`);
            }
        }
        
        if (business.name?.includes('[') || business.name?.includes(']')) {
            issues.push('Name contains brackets');
        }
        
        if (!business.address?.match(/^\d+[^,]+,\s*[^,]+,\s*[A-Z]{2}\s+\d{5}$/)) {
            const cleanedAddress = this.cleanAddress(business.address || '');
            if (cleanedAddress) {
                business.address = cleanedAddress;
            } else {
                issues.push('Address format incorrect');
            }
        }
        
        if (!business.phone?.match(/^\(\d{3}\) \d{3}-\d{4}$/)) {
            issues.push('Phone format incorrect');
        }
        
        if (business.email?.includes('[') || business.email?.includes('mailto:')) {
            issues.push('Email contains markdown/mailto');
        }
        
        if (business.description?.match(/\$|\b(?:call|email|visit|contact)\b/i)) {
            issues.push('Description contains pricing or contact info');
        }
        
        return issues;
    }

    private static async chat(messages: { role: string, content: string }[]) {
        return this.retryWithBackoff(async () => {
            try {
                const response = await axios.post(
                    this.OLLAMA_URL,
                    {
                        model: this.MODEL_NAME,
                        prompt: messages[0].content,
                        stream: false,
                        options: {
                            temperature: 0.7,  // Add some randomness
                            num_predict: 2048,
                            stop: ["<|im_end|>", "\n\n"],
                            top_k: 40,        // Allow more variety
                            top_p: 0.9,       // Allow more variety
                            seed: Date.now(),  // Force different results each time
                            reset: true        // Reset context window
                        }
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        timeout: 30000
                    }
                );

                return response.data.response;
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    if (error.code === 'ECONNREFUSED') {
                        throw new Error('Ollama server not running');
                    }
                    if (error.response?.status === 404) {
                        throw new Error(`Model ${this.MODEL_NAME} not found. Run: ollama pull ${this.MODEL_NAME}`);
                    }
                }
                throw error;
            }
        });
    }

    private static parseResponse(response: string) {
        const lines = response.split('\n');
        const cleaned: Partial<Business> = {};
        
        for (const line of lines) {
            const [field, ...values] = line.split(':');
            const value = values.join(':').trim();
            
            switch (field.toLowerCase().trim()) {
                case 'name':
                    cleaned.name = value;
                    break;
                case 'address':
                    cleaned.address = value;
                    break;
                case 'phone':
                    cleaned.phone = value;
                    break;
                case 'email':
                    cleaned.email = value;
                    break;
                case 'description':
                    cleaned.description = value;
                    break;
            }
        }

        return cleaned;
    }
} 