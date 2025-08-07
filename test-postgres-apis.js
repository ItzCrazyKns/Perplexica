#!/usr/bin/env node

/**
 * PostgreSQL API Integration Test Script
 * Tests the news/batch and legal-risk/analyze APIs with PostgreSQL
 */

console.log('=== PostgreSQL API Integration Tests ===\n');
console.log('⚠️  Prerequisites:');
console.log('1. PostgreSQL must be running locally');
console.log('2. Set DATABASE_URL environment variable');
console.log('3. Next.js server must be running (npm run dev)\n');

const API_BASE = 'http://localhost:3000/api';

// Test data
const newsTestData = {
  source: "tech_crawler",
  articles: [
    {
      title: "Apple Inc. Announces New AI Features",
      content: "Apple Inc. CEO Tim Cook announced major AI enhancements at the company's annual developer conference. The new features will integrate with iPhone and Mac products. SEC filings show increased R&D spending.",
      url: "https://example.com/apple-ai",
      publishedAt: new Date().toISOString(),
      author: "John Smith",
      category: "Technology",
      metadata: { tags: ["AI", "Apple", "Tech"] }
    },
    {
      title: "Tesla Reports Q4 Earnings, Elon Musk Discusses Future",
      content: "Tesla Inc. reported strong Q4 earnings. CEO Elon Musk outlined plans for expansion in Shanghai and New York facilities. The company faces regulatory scrutiny from the FTC.",
      url: "https://example.com/tesla-q4",
      publishedAt: new Date().toISOString(),
      author: "Jane Doe",
      category: "Finance"
    },
    {
      title: "Microsoft Corporation Partners with OpenAI",
      content: "Microsoft Corporation deepens partnership with OpenAI. The tech giant based in Seattle continues to invest in artificial intelligence. Bill Gates commented on the partnership's potential.",
      url: "https://example.com/microsoft-openai",
      category: "Technology"
    }
  ]
};

const riskTestData = {
  companyName: "CryptoFinance Ltd",
  industry: "Cryptocurrency Financial Services",
  searchNews: true, // Enable entity search in news
  dataPoints: {
    revenue: 2000000,
    employees: 15,
    yearFounded: 2023,
    location: "Singapore",
    publiclyTraded: false
  },
  concerns: [
    "New to cryptocurrency market",
    "Regulatory compliance pending",
    "Limited operational history",
    "High volatility sector"
  ]
};

// Test Commands
console.log('📝 Test Commands:\n');

// 1. POST News Batch
console.log('1️⃣  POST News Batch to PostgreSQL:');
console.log('```bash');
console.log(`curl -X POST ${API_BASE}/news/batch \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(newsTestData, null, 2)}'`);
console.log('```\n');

// 2. GET News (verify persistence)
console.log('2️⃣  GET News from PostgreSQL:');
console.log('```bash');
console.log(`# Get all news
curl ${API_BASE}/news/batch

# Get with filters and pagination
curl "${API_BASE}/news/batch?source=tech_crawler&limit=5&offset=0"

# Filter by category
curl "${API_BASE}/news/batch?category=Technology"`);
console.log('```\n');

// 3. POST Risk Analysis with Entity Recognition
console.log('3️⃣  POST Risk Analysis with Entity Recognition:');
console.log('```bash');
console.log(`curl -X POST ${API_BASE}/legal-risk/analyze \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(riskTestData, null, 2)}'`);
console.log('```\n');

// 4. GET Risk Analysis History
console.log('4️⃣  GET Risk Analysis History from PostgreSQL:');
console.log('```bash');
console.log(`# Get all analyses
curl ${API_BASE}/legal-risk/analyze

# Search by company name
curl "${API_BASE}/legal-risk/analyze?company=CryptoFinance"

# With pagination
curl "${API_BASE}/legal-risk/analyze?limit=5&offset=0"`);
console.log('```\n');

// Expected Responses
console.log('📊 Expected Responses:\n');

console.log('✅ News Batch POST Response:');
console.log(JSON.stringify({
  message: "News articles received and stored successfully",
  source: "tech_crawler",
  articlesReceived: 3,
  articlesProcessed: 3,
  totalStored: 3,
  processedArticles: ["...array of articles with PostgreSQL IDs..."],
  storage: "PostgreSQL"
}, null, 2));

console.log('\n✅ Risk Analysis POST Response with Entities:');
console.log(JSON.stringify({
  success: true,
  analysis: {
    companyName: "CryptoFinance Ltd",
    riskLevel: "high",
    riskScore: 73,
    categories: {
      regulatory: "high",
      financial: "high",
      reputational: "high",
      operational: "high",
      compliance: "critical"
    },
    factors: [
      "Company founded less than 2 years ago",
      "Small company size (less than 50 employees)",
      "High-risk industry: Cryptocurrency/Blockchain",
      "4 specific concerns identified",
      "Private company with limited public disclosure"
    ],
    recommendations: [
      "Perform detailed background checks",
      "Request financial statements and audits",
      "Ensure compliance with cryptocurrency regulations",
      "Verify AML/KYC procedures are in place"
    ],
    entities: [
      { entityName: "apple inc", entityType: "company", mentions: 1, sentiment: "neutral" },
      { entityName: "tesla inc", entityType: "company", mentions: 1, sentiment: "neutral" },
      { entityName: "microsoft corporation", entityType: "company", mentions: 1, sentiment: "neutral" },
      { entityName: "tim cook", entityType: "person", mentions: 1, sentiment: "neutral" },
      { entityName: "elon musk", entityType: "person", mentions: 1, sentiment: "neutral" },
      { entityName: "sec", entityType: "regulator", mentions: 1, sentiment: "neutral" },
      { entityName: "ftc", entityType: "regulator", mentions: 1, sentiment: "neutral" }
    ],
    timestamp: "2024-01-20T14:00:00.000Z"
  },
  message: "Risk analysis completed for CryptoFinance Ltd",
  storage: "PostgreSQL"
}, null, 2));

// Database Setup Instructions
console.log('\n🗄️  PostgreSQL Setup:\n');
console.log('1. Install PostgreSQL:');
console.log('   brew install postgresql@15  # macOS');
console.log('   sudo apt install postgresql # Ubuntu\n');

console.log('2. Start PostgreSQL:');
console.log('   brew services start postgresql@15  # macOS');
console.log('   sudo systemctl start postgresql    # Ubuntu\n');

console.log('3. Create Database:');
console.log('   createdb perplexica\n');

console.log('4. Set Environment Variable:');
console.log('   export DATABASE_URL="postgresql://user:password@localhost:5432/perplexica"\n');

console.log('5. Install Node Dependencies:');
console.log('   npm install pg @types/pg drizzle-orm\n');

// Verification Steps
console.log('✔️  Verification Steps:\n');
console.log('1. POST news articles using the curl command');
console.log('2. GET news to verify they were stored in PostgreSQL');
console.log('3. POST risk analysis with searchNews=true');
console.log('4. Check that entities were extracted from news');
console.log('5. GET risk analyses to verify persistence');
console.log('6. Restart server and GET again to confirm data persists\n');

// Notes
console.log('📌 Notes:');
console.log('- Tables are auto-created on first API call');
console.log('- Connection errors will return 503 status');
console.log('- Entity recognition uses pattern matching (Lagos-inspired)');
console.log('- All data persists in PostgreSQL (not in-memory)');
console.log('- Supports pagination with limit/offset parameters');
console.log('- News search is case-insensitive');
console.log('- Risk analyses are searchable by company name\n');

console.log('🚀 Ready to test PostgreSQL integration!');