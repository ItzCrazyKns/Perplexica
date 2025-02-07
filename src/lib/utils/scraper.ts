import axios from 'axios';
import * as cheerio from 'cheerio';
import { OllamaService } from '../services/ollamaService';
import { sleep } from './helpers';

const RATE_LIMIT_MS = 1000; // 1 second between requests
let lastRequestTime = 0;

async function rateLimitedRequest(url: string) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < RATE_LIMIT_MS) {
        await sleep(RATE_LIMIT_MS - timeSinceLastRequest);
    }
    
    lastRequestTime = Date.now();
    return axios.get(url, {
        timeout: 5000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BusinessFinder/1.0; +http://example.com/bot)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        }
    });
}

export interface ContactInfo {
    phone?: string;
    email?: string;
    address?: string;
    description?: string;
    openingHours?: string[];
}

export async function extractContactFromHtml(url: string): Promise<ContactInfo> {
    try {
        const response = await rateLimitedRequest(url);

        const $ = cheerio.load(response.data);
        
        // Extract structured data if available
        const structuredData = $('script[type="application/ld+json"]')
            .map((_, el) => {
                try {
                    return JSON.parse($(el).html() || '');
                } catch {
                    return null;
                }
            })
            .get()
            .filter(Boolean);

        // Look for LocalBusiness or Restaurant schema
        const businessData = structuredData.find(data => 
            data['@type'] === 'LocalBusiness' || 
            data['@type'] === 'Restaurant'
        );

        if (businessData) {
            return {
                phone: businessData.telephone,
                email: businessData.email,
                address: businessData.address?.streetAddress,
                description: businessData.description,
                openingHours: businessData.openingHours
            };
        }

        // Fallback to regular HTML parsing
        return {
            phone: findPhone($),
            email: findEmail($),
            address: findAddress($),
            description: $('meta[name="description"]').attr('content'),
            openingHours: findOpeningHours($)
        };
    } catch (error) {
        console.warn(`Error extracting contact info from ${url}:`, error);
        return {};
    }
}

export async function extractCleanAddress(text: string, location: string): Promise<string> {
    try {
        const ollama = new OllamaService();
        const prompt = `
            Extract a business address from this text. The business should be in or near ${location}.
            Only return the address, nothing else. If no valid address is found, return an empty string.
            
            Text: ${text}
        `;

        const response = await OllamaService.complete(prompt);
        return response.trim();
    } catch (error) {
        console.warn('Error extracting address:', error);
        return '';
    }
}

// Helper functions
function findPhone($: cheerio.CheerioAPI): string | undefined {
    // Common phone patterns
    const phonePatterns = [
        /\b\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/,
        /\b(?:Phone|Tel|Contact):\s*([0-9-().+ ]{10,})\b/i
    ];

    for (const pattern of phonePatterns) {
        const match = $.text().match(pattern);
        if (match) return match[0];
    }

    return undefined;
}

function findEmail($: cheerio.CheerioAPI): string | undefined {
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const match = $.text().match(emailPattern);
    return match ? match[0] : undefined;
}

function findAddress($: cheerio.CheerioAPI): string | undefined {
    // Look for address in common elements
    const addressSelectors = [
        'address',
        '[itemtype="http://schema.org/PostalAddress"]',
        '.address',
        '#address',
        '[class*="address"]',
        '[id*="address"]'
    ];

    for (const selector of addressSelectors) {
        const element = $(selector).first();
        if (element.length) {
            return element.text().trim();
        }
    }

    return undefined;
}

function findOpeningHours($: cheerio.CheerioAPI): string[] {
    const hours: string[] = [];
    const hoursSelectors = [
        '[itemtype="http://schema.org/OpeningHoursSpecification"]',
        '.hours',
        '#hours',
        '[class*="hours"]',
        '[id*="hours"]'
    ];

    for (const selector of hoursSelectors) {
        const element = $(selector).first();
        if (element.length) {
            element.find('*').each((_, el) => {
                const text = $(el).text().trim();
                if (text && !hours.includes(text)) {
                    hours.push(text);
                }
            });
        }
    }

    return hours;
} 