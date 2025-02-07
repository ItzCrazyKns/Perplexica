import { DeepSeekService } from './deepseekService';
import { Business } from '../types';
import { db } from './databaseService';

// Constants for validation and scoring
const BATCH_SIZE = 3; // Process businesses in small batches to avoid overwhelming LLM
const LLM_TIMEOUT = 30000; // 30 second timeout for LLM requests
const MIN_CONFIDENCE_SCORE = 0.7; // Minimum score required to cache results
const VALID_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const VALID_PHONE_REGEX = /^\(\d{3}\) \d{3}-\d{4}$/;
const VALID_ADDRESS_REGEX = /^\d+.*(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|circle|cir|way|parkway|pkwy|place|pl),?\s+[a-z ]+,\s*[a-z]{2}\s+\d{5}$/i;

export class CleanupService {
    /**
     * Attempts to clean business data using LLM with timeout protection.
     * Falls back to original data if LLM fails or times out.
     */
    private static async cleanWithLLM(prompt: string, originalBusiness: Business): Promise<string> {
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('LLM timeout')), LLM_TIMEOUT);
            });

            const llmPromise = DeepSeekService.chat([{
                role: 'user',
                content: prompt
            }]);

            const response = await Promise.race([llmPromise, timeoutPromise]);
            return (response as string).trim();
        } catch (error) {
            console.error('LLM cleanup error:', error);
            // On timeout, return the original values
            return `
                Address: ${originalBusiness.address}
                Phone: ${originalBusiness.phone}
                Email: ${originalBusiness.email}
                Description: ${originalBusiness.description}
            `;
        }
    }

    /**
     * Calculates a confidence score (0-1) for the cleaned business data.
     * Score is based on:
     * - Valid email format (0.25)
     * - Valid phone format (0.25)
     * - Valid address format (0.25)
     * - Description quality (0.25)
     */
    private static calculateConfidenceScore(business: Business): number {
        let score = 0;
        
        // Valid email adds 0.25
        if (business.email && VALID_EMAIL_REGEX.test(business.email)) {
            score += 0.25;
        }
        
        // Valid phone adds 0.25
        if (business.phone && VALID_PHONE_REGEX.test(business.phone)) {
            score += 0.25;
        }
        
        // Valid address adds 0.25
        if (business.address && VALID_ADDRESS_REGEX.test(business.address)) {
            score += 0.25;
        }
        
        // Description quality checks (0.25 max)
        if (business.description) {
            // Length check (0.1)
            if (business.description.length > 30 && business.description.length < 200) {
                score += 0.1;
            }
            
            // Relevance check (0.1)
            const businessType = this.getBusinessType(business.name);
            if (business.description.toLowerCase().includes(businessType)) {
                score += 0.1;
            }
            
            // No HTML/markdown (0.05)
            if (!/[<>[\]()]/.test(business.description)) {
                score += 0.05;
            }
        }

        return score;
    }

    /**
     * Determines the type of business based on name keywords.
     * Used for validating and generating descriptions.
     */
    private static getBusinessType(name: string): string {
        const types = [
            'restaurant', 'plumber', 'electrician', 'cafe', 'bar', 
            'salon', 'shop', 'store', 'service'
        ];
        
        const nameLower = name.toLowerCase();
        return types.find(type => nameLower.includes(type)) || 'business';
    }

    /**
     * Parses LLM response into structured business data.
     * Expects format: "field: value" for each line.
     */
    private static parseResponse(response: string): Partial<Business> {
        const cleaned: Partial<Business> = {};
        const lines = response.split('\n');
        
        for (const line of lines) {
            const [field, ...values] = line.split(':');
            const value = values.join(':').trim();
            
            switch (field.toLowerCase().trim()) {
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

    /**
     * Applies validation rules and cleaning to each field.
     * - Standardizes formats
     * - Removes invalid data
     * - Ensures consistent formatting
     */
    private static validateAndClean(business: Business): Business {
        const cleaned = { ...business };

        // Email validation and cleaning
        if (cleaned.email) {
            cleaned.email = cleaned.email
                .toLowerCase()
                .replace(/\[|\]|\(mailto:.*?\)/g, '')
                .replace(/^\d+-\d+/, '')
                .trim();
            
            if (!VALID_EMAIL_REGEX.test(cleaned.email) || 
                ['none', 'n/a', 'union office', ''].includes(cleaned.email.toLowerCase())) {
                cleaned.email = '';
            }
        }

        // Phone validation and cleaning
        if (cleaned.phone) {
            const digits = cleaned.phone.replace(/\D/g, '');
            if (digits.length === 10) {
                cleaned.phone = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
            } else {
                cleaned.phone = '';
            }
        }

        // Address validation and cleaning
        if (cleaned.address) {
            cleaned.address = cleaned.address
                .replace(/^.*?(?=\d|[A-Z])/s, '')
                .replace(/^(Sure!.*?:|The business.*?:|.*?address.*?:)(?:\s*\\n)*\s*/si, '')
                .replace(/\s+/g, ' ')
                .trim();
            
            // Standardize state abbreviations
            cleaned.address = cleaned.address.replace(/\b(Colorado|Colo|Col)\b/gi, 'CO');
        }

        // Description validation and cleaning
        if (cleaned.description) {
            cleaned.description = cleaned.description
                .replace(/\$\d+(\.\d{2})?/g, '') // Remove prices
                .replace(/\b(call|email|website|click|visit)\b.*$/i, '') // Remove calls to action
                .replace(/\s+/g, ' ')
                .trim();

            const businessType = this.getBusinessType(cleaned.name);
            if (businessType !== 'business' && 
                !cleaned.description.toLowerCase().includes(businessType)) {
                cleaned.description = `${businessType.charAt(0).toUpperCase() + businessType.slice(1)} services in the Denver area.`;
            }
        }

        return cleaned;
    }

    static async cleanBusinessRecord(business: Business): Promise<Business> {
        // Check cache first
        const cacheKey = `clean:${business.id}`;
        const cached = await db.getFromCache(cacheKey);
        if (cached) {
            console.log('Using cached clean data for:', business.name);
            return cached;
        }

        // Clean using DeepSeek
        const cleaned = await DeepSeekService.cleanBusinessData(business);
        const validated = this.validateAndClean({ ...business, ...cleaned });
        
        // Only cache if confidence score is high enough
        const confidence = this.calculateConfidenceScore(validated);
        if (confidence >= MIN_CONFIDENCE_SCORE) {
            await db.saveToCache(cacheKey, validated, 24 * 60 * 60 * 1000);
        }

        return validated;
    }

    static async cleanBusinessRecords(businesses: Business[]): Promise<Business[]> {
        const cleanedBusinesses: Business[] = [];
        
        // Process in batches
        for (let i = 0; i < businesses.length; i += BATCH_SIZE) {
            const batch = businesses.slice(i, i + BATCH_SIZE);
            const cleanedBatch = await Promise.all(
                batch.map(business => this.cleanBusinessRecord(business))
            );
            cleanedBusinesses.push(...cleanedBatch);
        }
        
        return cleanedBusinesses;
    }
} 