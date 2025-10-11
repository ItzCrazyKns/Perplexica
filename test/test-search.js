/**
 * Simple test script to verify Google Custom Search integration
 * Run with: node test-search.js
 */

const { search } = require('./src/lib/search/providers/index.ts');

async function testSearch() {
  console.log('🔍 Testing Google Custom Search integration...\n');

  try {
    const testQuery = 'artificial intelligence';
    console.log(`Query: "${testQuery}"\n`);

    const results = await search(testQuery, {
      language: 'en',
    });

    console.log(`✅ Search successful!`);
    console.log(`\nFound ${results.results.length} results:\n`);

    results.results.slice(0, 5).forEach((result, i) => {
      console.log(`${i + 1}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Snippet: ${result.content?.substring(0, 100)}...`);
      console.log('');
    });

    if (results.suggestions.length > 0) {
      console.log(`Suggestions: ${results.suggestions.join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Search failed:', error.message);
    console.error('\nFull error:', error);
  }
}

testSearch();
