import { searchSearxng } from '../lib/searxng';

async function testSearchEngine() {
  try {
    console.log('Testing SearxNG connection...');
    
    const results = await searchSearxng('plumbers in Denver', {
      engines: ['google', 'bing', 'duckduckgo'],
      pageno: 1
    });

    if (results && results.results && results.results.length > 0) {
      console.log('✅ Search successful!');
      console.log('Number of results:', results.results.length);
      console.log('First result:', results.results[0]);
    } else {
      console.log('❌ No results found');
    }

  } catch (error) {
    console.error('❌ Search test failed:', error);
    console.error('Make sure SearxNG is running on http://localhost:4000');
  }
}

testSearchEngine(); 