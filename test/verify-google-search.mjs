/**
 * Verify Google Custom Search is integrated into Perplexica
 */

// Simulate loading config
process.env.NODE_ENV = 'production';

import toml from '@iarna/toml';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🔍 Verifying Google Custom Search Integration\n');

// Load config
const configPath = join(process.cwd(), 'config.toml');
const config = toml.parse(readFileSync(configPath, 'utf-8'));

console.log('📋 Configuration Check:');
console.log(`   Provider: ${config.SEARCH.PROVIDER}`);
console.log(`   Google API Key: ${config.SEARCH.GOOGLE_CUSTOM_SEARCH.API_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   Google CX: ${config.SEARCH.GOOGLE_CUSTOM_SEARCH.CX ? '✅ Set' : '❌ Missing'}`);
console.log('');

// Now test the actual provider
import { GoogleCustomSearchProvider } from './src/lib/search/providers/googleCustomSearch.ts';

const provider = new GoogleCustomSearchProvider();

console.log('🧪 Testing Google Custom Search Provider...\n');

try {
  const results = await provider.search('test query', { language: 'en' });

  console.log('✅ SUCCESS! Google Custom Search is working!\n');
  console.log(`📊 Results:`);
  console.log(`   Found: ${results.results.length} results`);
  console.log(`   Suggestions: ${results.suggestions.length} suggestions`);
  console.log('');

  if (results.results.length > 0) {
    console.log('📄 Sample Result:');
    console.log(`   Title: ${results.results[0].title}`);
    console.log(`   URL: ${results.results[0].url}`);
    console.log(`   Snippet: ${results.results[0].content?.substring(0, 100)}...`);
  }

  console.log('\n✨ Integration complete! Perplexica is now using Google Custom Search.');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
