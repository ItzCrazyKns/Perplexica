import { DeepSeekService } from '../lib/services/deepseekService';
import dotenv from 'dotenv';

dotenv.config();

async function testDeepseekService() {
    const service = new DeepSeekService();
    
    try {
        console.log('Starting DeepSeek test...');
        console.log('Base URL:', process.env.OLLAMA_URL || 'http://localhost:11434');

        const testQuery = {
            role: "user",
            content: "Find plumbers in Denver, CO. You must return exactly 10 results in valid JSON format, sorted by rating from highest to lowest. Each result must include a rating between 1-5 stars. Do not include any comments or explanations in the JSON."
        };

        console.log('Sending test query:', testQuery);

        const response = await service.chat([testQuery]);
        
        console.log('\nTest successful!');
        console.log('Parsed response:', JSON.stringify(response, null, 2));
        
    } catch (error) {
        console.error('\nTest failed!');
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack trace:', error.stack);
        } else {
            console.error('Unknown error:', error);
        }
    }
}

// Run the test
console.log('=== Starting DeepSeek Service Test ===\n');
testDeepseekService().then(() => {
    console.log('\n=== Test Complete ===');
}).catch(error => {
    console.error('\n=== Test Failed ===');
    console.error(error);
}); 