// Test script for the new API endpoints
// This demonstrates how to use the APIs

console.log('=== API Test Examples ===\n');

// Test data for news/batch API
const newsTestData = {
  source: "test_crawler",
  articles: [
    {
      title: "Breaking: Tech Company Announces Major Update",
      content: "A leading technology company has announced a major update to their flagship product...",
      url: "https://example.com/news/1",
      publishedAt: "2024-01-20T10:00:00Z",
      author: "John Doe",
      category: "Technology"
    },
    {
      title: "Market Analysis: Q1 2024 Trends",
      content: "Financial experts predict significant changes in market trends for Q1 2024...",
      url: "https://example.com/news/2",
      publishedAt: "2024-01-20T11:00:00Z",
      author: "Jane Smith",
      category: "Finance"
    }
  ]
};

// Test data for legal-risk/analyze API
const riskTestData = {
  companyName: "TestCorp Inc.",
  industry: "Financial Services",
  description: "A fintech startup providing payment solutions",
  dataPoints: {
    revenue: 5000000,
    employees: 25,
    yearFounded: 2022,
    location: "New York, USA",
    publiclyTraded: false
  },
  concerns: [
    "New to market",
    "Regulatory compliance pending",
    "Limited operational history"
  ]
};

console.log('1. Test POST to /api/news/batch');
console.log('   Command:');
console.log(`   curl -X POST http://localhost:3000/api/news/batch \\
     -H "Content-Type: application/json" \\
     -d '${JSON.stringify(newsTestData, null, 2)}'`);

console.log('\n2. Test GET from /api/news/batch');
console.log('   Command:');
console.log('   curl http://localhost:3000/api/news/batch');
console.log('   curl "http://localhost:3000/api/news/batch?limit=5&source=test_crawler"');

console.log('\n3. Test POST to /api/legal-risk/analyze');
console.log('   Command:');
console.log(`   curl -X POST http://localhost:3000/api/legal-risk/analyze \\
     -H "Content-Type: application/json" \\
     -d '${JSON.stringify(riskTestData, null, 2)}'`);

console.log('\n4. Test GET from /api/legal-risk/analyze');
console.log('   Command:');
console.log('   curl http://localhost:3000/api/legal-risk/analyze');
console.log('   curl "http://localhost:3000/api/legal-risk/analyze?company=TestCorp"');

console.log('\n=== Expected Responses ===\n');

console.log('News Batch POST Response:');
console.log(JSON.stringify({
  message: "News articles received successfully",
  source: "test_crawler",
  articlesReceived: 2,
  articlesProcessed: 2,
  totalStored: 2,
  processedArticles: ["...array of processed articles..."]
}, null, 2));

console.log('\nLegal Risk Analysis Response:');
console.log(JSON.stringify({
  success: true,
  analysis: {
    companyName: "TestCorp Inc.",
    riskLevel: "high",
    riskScore: 65,
    categories: {
      regulatory: "high",
      financial: "high",
      reputational: "high",
      operational: "high",
      compliance: "medium"
    },
    factors: [
      "Company founded less than 2 years ago",
      "Small company size (less than 50 employees)",
      "Regulated industry: Financial Services",
      "3 specific concerns identified",
      "Private company with limited public disclosure"
    ],
    recommendations: [
      "Perform detailed background checks",
      "Request financial statements and audits",
      "Establish clear contractual protections",
      "Schedule regular compliance reviews",
      "Request proof of concept and business viability",
      "Verify founders' backgrounds and experience"
    ],
    timestamp: "2024-01-20T12:00:00.000Z"
  },
  message: "Risk analysis completed for TestCorp Inc."
}, null, 2));

console.log('\n=== Notes ===');
console.log('- Make sure the Next.js server is running on port 3000');
console.log('- Run: npm run dev');
console.log('- APIs use in-memory storage (data will be lost on server restart)');
console.log('- News API stores up to 1000 articles');
console.log('- Risk Analysis API stores up to 100 analyses');
console.log('- PostgreSQL integration to be added later');