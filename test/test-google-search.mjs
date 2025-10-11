/**
 * Test Google Custom Search integration
 */

import axios from 'axios';

async function testGoogleSearch() {
  console.log('🔍 Testing Google Custom Search API directly...\n');

  const API_KEY = 'AIzaSyAn9lVWn3CnKqJLn9RpUEZdo4Mygqi-J0Y';
  const CX = '36d084cfec01b4893';
  const query = 'artificial intelligence';

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.append('key', API_KEY);
    url.searchParams.append('cx', CX);
    url.searchParams.append('q', query);

    console.log(`Query: "${query}"\n`);
    console.log('Making request to Google Custom Search API...\n');

    const response = await axios.get(url.toString());
    const items = response.data.items || [];

    console.log(`✅ Success! Found ${items.length} results:\n`);

    items.slice(0, 5).forEach((item, i) => {
      console.log(`${i + 1}. ${item.title}`);
      console.log(`   URL: ${item.link}`);
      console.log(`   Snippet: ${item.snippet}`);
      console.log('');
    });

    console.log('\n📊 API Response Info:');
    console.log(`   Search Time: ${response.data.searchInformation?.searchTime}s`);
    console.log(`   Total Results: ${response.data.searchInformation?.formattedTotalResults}`);

  } catch (error) {
    console.error('❌ Search failed:', error.response?.data || error.message);
    if (error.response?.status === 429) {
      console.error('\n⚠️  Rate limit exceeded. You may have hit your daily quota.');
    }
  }
}

testGoogleSearch();
