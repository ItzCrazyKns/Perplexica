import EventEmitter from 'events';
import { DeepSeekService } from './deepseekService';
import { DatabaseService } from './databaseService';
import { Business } from '../types';

interface PartialBusiness {
    name: string;
    address: string;
    phone: string;
    description: string;
    website?: string;
    rating?: number;
    source?: string;
    location?: {
        lat: number;
        lng: number;
    };
}

export class SearchService extends EventEmitter {
    private deepseekService: DeepSeekService;
    private databaseService: DatabaseService;

    constructor() {
        super();
        this.deepseekService = new DeepSeekService();
        this.databaseService = new DatabaseService();
        
        this.deepseekService.on('progress', (data) => {
            this.emit('progress', data);
        });
    }

    async streamSearch(query: string, location: string, limit: number = 10): Promise<void> {
        try {
            // First, try to find cached results in database
            const cachedResults = await this.databaseService.findBusinessesByQuery(query, location);
            if (cachedResults.length > 0) {
                // Emit cached results one by one
                for (const result of this.sortByRating(cachedResults).slice(0, limit)) {
                    this.emit('result', result);
                    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between results
                }
                this.emit('complete');
                return;
            }

            // If no cached results, use DeepSeek to generate new results
            const aiResults = await this.deepseekService.streamChat([{
                role: "user",
                content: `Find ${query} in ${location}. You must return exactly ${limit} results in valid JSON format, sorted by rating from highest to lowest. Each result must include a rating between 1-5 stars. Do not include any comments or explanations in the JSON.`
            }], async (business: PartialBusiness) => {
                try {
                    // Extract lat/lng from address using a geocoding service
                    const coords = await this.geocodeAddress(business.address);
                    
                    // Save to database and emit result
                    const savedBusiness = await this.databaseService.saveBusiness({
                        ...business,
                        source: 'deepseek',
                        location: coords || {
                            lat: 39.7392, // Denver's default coordinates
                            lng: -104.9903
                        }
                    });

                    this.emit('result', savedBusiness);
                } catch (error) {
                    console.error('Error processing business:', error);
                    this.emit('error', error);
                }
            });

            this.emit('complete');

        } catch (error) {
            console.error('Search error:', error);
            this.emit('error', error);
            throw error;
        }
    }

    async search(query: string, location: string, limit: number = 10): Promise<Business[]> {
        try {
            // First, try to find cached results in database
            const cachedResults = await this.databaseService.findBusinessesByQuery(query, location);
            if (cachedResults.length > 0) {
                return this.sortByRating(cachedResults).slice(0, limit);
            }

            // If no cached results, use DeepSeek to generate new results
            const aiResults = await this.deepseekService.chat([{
                role: "user",
                content: `Find ${query} in ${location}. You must return exactly ${limit} results in valid JSON format, sorted by rating from highest to lowest. Each result must include a rating between 1-5 stars. Do not include any comments or explanations in the JSON.`
            }]);

            // Save the results to database
            const savedResults = await Promise.all(
                (aiResults as PartialBusiness[]).map(async (business: PartialBusiness) => {
                    // Extract lat/lng from address using a geocoding service
                    const coords = await this.geocodeAddress(business.address);
                    
                    return this.databaseService.saveBusiness({
                        ...business,
                        source: 'deepseek',
                        location: coords || {
                            lat: 39.7392, // Denver's default coordinates
                            lng: -104.9903
                        }
                    });
                })
            );

            return this.sortByRating(savedResults);

        } catch (error) {
            console.error('Search error:', error);
            throw error;
        }
    }

    private sortByRating(businesses: Business[]): Business[] {
        return businesses.sort((a, b) => b.rating - a.rating);
    }

    private async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
        // TODO: Implement real geocoding service
        // For now, return null to use default coordinates
        return null;
    }

    async getBusinessById(id: string): Promise<Business | null> {
        return this.databaseService.getBusinessById(id);
    }
} 