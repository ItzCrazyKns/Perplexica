import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testOllamaConnection() {
    const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    
    console.log('Testing Ollama connection...');
    console.log('Base URL:', baseUrl);

    try {
        // Simple test request
        const response = await axios.post(`${baseUrl}/api/chat`, {
            model: 'deepseek-coder:6.7b',
            messages: [{
                role: 'user',
                content: 'Return a simple JSON array with one object: {"test": "success"}'
            }],
            stream: false
        });

        console.log('\nResponse received:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('Connection test failed:');
        if (axios.isAxiosError(error)) {
            console.error('Network error:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
        } else {
            console.error('Error:', error);
        }
    }
}

console.log('=== Starting Ollama Connection Test ===\n');
testOllamaConnection().then(() => {
    console.log('\n=== Test Complete ===');
}).catch(error => {
    console.error('\n=== Test Failed ===');
    console.error(error);
}); 