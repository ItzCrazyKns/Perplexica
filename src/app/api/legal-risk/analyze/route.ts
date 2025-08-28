import { db, riskAnalyses, entityMentions, newsArticles, testConnection, initializeTables } from '@/lib/db/postgres';
import { eq, desc, like, and, sql } from 'drizzle-orm';

// Initialize database on module load
initializeTables().catch(console.error);

// Risk level definitions
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface RiskAnalysisRequest {
  companyName: string;
  industry?: string;
  description?: string;
  searchNews?: boolean; // Whether to search for entity mentions in news
  dataPoints?: {
    revenue?: number;
    employees?: number;
    yearFounded?: number;
    location?: string;
    publiclyTraded?: boolean;
  };
  concerns?: string[];
}

interface RiskAnalysisResponse {
  companyName: string;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  categories: {
    regulatory: RiskLevel;
    financial: RiskLevel;
    reputational: RiskLevel;
    operational: RiskLevel;
    compliance: RiskLevel;
  };
  factors: string[];
  recommendations: string[];
  entities?: Array<{ // Entities found in news
    entityName: string;
    entityType: string;
    mentions: number;
    sentiment: string;
  }>;
  timestamp: string;
}

// Lagos-inspired prompts for risk analysis
const LAGOS_PROMPTS = {
  entityRecognition: `
    Identify key entities mentioned in this text:
    - Company names
    - Person names (executives, founders, key personnel)
    - Location names
    - Product or service names
    - Regulatory bodies
    Focus on: {text}
  `,
  riskAssessment: `
    Analyze the legal and business risk for {company} based on:
    - Industry: {industry}
    - Known concerns: {concerns}
    - Recent news mentions: {newsContext}
    Provide risk factors and recommendations.
  `,
  sentimentAnalysis: `
    Determine the sentiment (positive, negative, neutral) for mentions of {entity} in:
    {context}
  `
};

// Entity recognition using keyword matching (simplified version)
const recognizeEntities = async (text: string, primaryEntity?: string): Promise<Array<{name: string, type: string}>> => {
  const entities: Array<{name: string, type: string}> = [];
  
  // Common patterns for entity recognition
  const patterns = {
    company: [
      /\b[A-Z][\w&]+(\s+(Inc|LLC|Ltd|Corp|Corporation|Company|Co|Group|Holdings|Technologies|Tech|Systems|Solutions|Services))\.?\b/gi,
      /\b[A-Z][\w]+\s+[A-Z][\w]+\b/g, // Two capitalized words
    ],
    person: [
      /\b(Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+(CEO|CFO|CTO|COO|President|Director|Manager|Founder)\b/gi,
    ],
    location: [
      /\b(New York|London|Tokyo|Singapore|Hong Kong|San Francisco|Beijing|Shanghai|Mumbai|Dubai)\b/gi,
      /\b[A-Z][a-z]+,\s+[A-Z]{2}\b/g, // City, State format
    ],
    regulator: [
      /\b(SEC|FTC|FDA|EPA|DOJ|FBI|CIA|NSA|FCC|CFTC|FINRA|OCC|FDIC)\b/g,
      /\b(Securities and Exchange Commission|Federal Trade Commission|Department of Justice)\b/gi,
    ],
  };

  // Extract entities using patterns
  for (const [type, patternList] of Object.entries(patterns)) {
    for (const pattern of patternList) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleanMatch = match.trim();
          if (!entities.some(e => e.name.toLowerCase() === cleanMatch.toLowerCase())) {
            entities.push({ name: cleanMatch, type });
          }
        });
      }
    }
  }

  // Always include the primary entity if provided
  if (primaryEntity && !entities.some(e => e.name.toLowerCase() === primaryEntity.toLowerCase())) {
    entities.push({ name: primaryEntity, type: 'company' });
  }

  return entities;
};

// Search for entity mentions in news articles
const searchEntityInNews = async (entityName: string) => {
  try {
    // Search for the entity in news articles
    const results = await db
      .select()
      .from(newsArticles)
      .where(
        sql`LOWER(${newsArticles.title}) LIKE LOWER(${'%' + entityName + '%'}) OR 
            LOWER(${newsArticles.content}) LIKE LOWER(${'%' + entityName + '%'})`
      )
      .orderBy(desc(newsArticles.createdAt))
      .limit(10);

    return results;
  } catch (error) {
    console.error('Error searching entity in news:', error);
    return [];
  }
};

// Helper function to calculate risk score based on various factors
const calculateRiskScore = (data: RiskAnalysisRequest): number => {
  let score = 30; // Base score

  // Industry-based risk adjustment
  const highRiskIndustries = ['crypto', 'gambling', 'pharmaceutical', 'financial services', 'mining'];
  const mediumRiskIndustries = ['technology', 'manufacturing', 'retail', 'real estate'];
  
  if (data.industry) {
    const industryLower = data.industry.toLowerCase();
    if (highRiskIndustries.some(ind => industryLower.includes(ind))) {
      score += 25;
    } else if (mediumRiskIndustries.some(ind => industryLower.includes(ind))) {
      score += 15;
    }
  }

  // Company age risk (newer companies = higher risk)
  if (data.dataPoints?.yearFounded) {
    const age = new Date().getFullYear() - data.dataPoints.yearFounded;
    if (age < 2) score += 20;
    else if (age < 5) score += 10;
    else if (age > 20) score -= 10;
  }

  // Size-based risk (smaller companies = higher risk)
  if (data.dataPoints?.employees) {
    if (data.dataPoints.employees < 10) score += 15;
    else if (data.dataPoints.employees < 50) score += 10;
    else if (data.dataPoints.employees > 500) score -= 10;
  }

  // Concerns-based risk
  if (data.concerns && data.concerns.length > 0) {
    score += data.concerns.length * 5;
  }

  // Public company adjustment (public = lower risk due to more oversight)
  if (data.dataPoints?.publiclyTraded) {
    score -= 15;
  }

  // Ensure score is within 0-100 range
  return Math.max(0, Math.min(100, score));
};

// Helper function to determine risk level from score
const getRiskLevel = (score: number): RiskLevel => {
  if (score < 30) return 'low';
  if (score < 50) return 'medium';
  if (score < 75) return 'high';
  return 'critical';
};

// Helper function to generate risk factors
const generateRiskFactors = (data: RiskAnalysisRequest, score: number): string[] => {
  const factors = [];

  if (data.dataPoints?.yearFounded) {
    const age = new Date().getFullYear() - data.dataPoints.yearFounded;
    if (age < 2) factors.push('Company founded less than 2 years ago');
    else if (age < 5) factors.push('Relatively new company (less than 5 years)');
  }

  if (data.dataPoints?.employees) {
    if (data.dataPoints.employees < 10) {
      factors.push('Very small company size (less than 10 employees)');
    } else if (data.dataPoints.employees < 50) {
      factors.push('Small company size (less than 50 employees)');
    }
  }

  if (data.industry) {
    const industryLower = data.industry.toLowerCase();
    if (industryLower.includes('crypto') || industryLower.includes('blockchain')) {
      factors.push('High-risk industry: Cryptocurrency/Blockchain');
    } else if (industryLower.includes('financial')) {
      factors.push('Regulated industry: Financial Services');
    }
  }

  if (data.concerns && data.concerns.length > 0) {
    factors.push(`${data.concerns.length} specific concerns identified`);
    data.concerns.forEach(concern => {
      factors.push(`Concern: ${concern}`);
    });
  }

  if (!data.dataPoints?.publiclyTraded) {
    factors.push('Private company with limited public disclosure');
  }

  if (score > 70) {
    factors.push('Multiple high-risk indicators present');
  }

  return factors;
};

// Helper function to generate recommendations
const generateRecommendations = (score: number, data: RiskAnalysisRequest): string[] => {
  const recommendations = [];
  const riskLevel = getRiskLevel(score);

  // General recommendations based on risk level
  switch (riskLevel) {
    case 'critical':
      recommendations.push('Conduct immediate comprehensive due diligence');
      recommendations.push('Require enhanced compliance documentation');
      recommendations.push('Consider requiring additional guarantees or collateral');
      recommendations.push('Implement continuous monitoring protocols');
      break;
    case 'high':
      recommendations.push('Perform detailed background checks');
      recommendations.push('Request financial statements and audits');
      recommendations.push('Establish clear contractual protections');
      recommendations.push('Schedule regular compliance reviews');
      break;
    case 'medium':
      recommendations.push('Conduct standard due diligence procedures');
      recommendations.push('Verify business registration and licenses');
      recommendations.push('Review company reputation and references');
      break;
    case 'low':
      recommendations.push('Proceed with standard business practices');
      recommendations.push('Maintain regular monitoring schedule');
      break;
  }

  // Specific recommendations based on factors
  if (data.dataPoints?.yearFounded) {
    const age = new Date().getFullYear() - data.dataPoints.yearFounded;
    if (age < 2) {
      recommendations.push('Request proof of concept and business viability');
      recommendations.push('Verify founders\' backgrounds and experience');
    }
  }

  if (data.industry?.toLowerCase().includes('crypto')) {
    recommendations.push('Ensure compliance with cryptocurrency regulations');
    recommendations.push('Verify AML/KYC procedures are in place');
  }

  if (!data.dataPoints?.publiclyTraded && score > 50) {
    recommendations.push('Request additional financial transparency');
    recommendations.push('Consider third-party verification services');
  }

  return recommendations;
};

// POST endpoint - Analyze enterprise risk
export const POST = async (req: Request) => {
  try {
    const body: RiskAnalysisRequest = await req.json();

    // Validate required fields
    if (!body.companyName) {
      return Response.json(
        {
          message: 'Invalid request. Company name is required.',
        },
        { status: 400 }
      );
    }

    // Calculate risk score
    const riskScore = calculateRiskScore(body);
    const riskLevel = getRiskLevel(riskScore);

    // Generate category-specific risk levels (simplified simulation)
    const categories = {
      regulatory: getRiskLevel(riskScore + (body.industry?.toLowerCase().includes('financial') ? 20 : -10)),
      financial: getRiskLevel(riskScore + (body.dataPoints?.publiclyTraded ? -20 : 10)),
      reputational: getRiskLevel(riskScore + (body.concerns?.length ? body.concerns.length * 10 : 0)),
      operational: getRiskLevel(riskScore + (body.dataPoints?.employees && body.dataPoints.employees < 50 ? 15 : -5)),
      compliance: getRiskLevel(riskScore + (body.industry?.toLowerCase().includes('crypto') ? 25 : 0)),
    };

    // Generate risk factors and recommendations
    const factors = generateRiskFactors(body, riskScore);
    const recommendations = generateRecommendations(riskScore, body);

    // Search for entity mentions in news if requested
    let entityAnalysis = undefined;
    if (body.searchNews) {
      const newsResults = await searchEntityInNews(body.companyName);
      const mentionedEntities = new Map<string, { type: string; mentions: number; sentiment: string }>();

      // Analyze each news article for entities
      for (const article of newsResults) {
        const entities = await recognizeEntities(
          article.title + ' ' + article.content, 
          body.companyName
        );

        for (const entity of entities) {
          const key = entity.name.toLowerCase();
          if (!mentionedEntities.has(key)) {
            mentionedEntities.set(key, {
              type: entity.type,
              mentions: 0,
              sentiment: 'neutral', // Simplified sentiment
            });
          }
          mentionedEntities.get(key)!.mentions++;

          // Store entity mention in database
          try {
            await db.insert(entityMentions).values({
              articleId: article.id,
              entityName: entity.name,
              entityType: entity.type,
              mentionContext: article.title.substring(0, 200),
              sentiment: 'neutral', // Simplified for now
              createdAt: new Date(),
            });
          } catch (err) {
            console.error('Error storing entity mention:', err);
          }
        }
      }

      entityAnalysis = Array.from(mentionedEntities.entries()).map(([name, data]) => ({
        entityName: name,
        entityType: data.type,
        mentions: data.mentions,
        sentiment: data.sentiment,
      }));
    }

    // Create response
    const analysis: RiskAnalysisResponse = {
      companyName: body.companyName,
      riskLevel,
      riskScore,
      categories,
      factors,
      recommendations,
      entities: entityAnalysis,
      timestamp: new Date().toISOString(),
    };

    // Store analysis in PostgreSQL
    try {
      const isConnected = await testConnection();
      if (isConnected) {
        await db.insert(riskAnalyses).values({
          companyName: body.companyName,
          industry: body.industry || null,
          riskLevel,
          riskScore,
          categories,
          factors,
          recommendations,
          dataPoints: body.dataPoints || null,
          concerns: body.concerns || null,
          createdAt: new Date(),
        });
      }
    } catch (dbError) {
      console.error('Error storing risk analysis:', dbError);
    }

    return Response.json({
      success: true,
      analysis,
      message: `Risk analysis completed for ${body.companyName}`,
      storage: 'PostgreSQL',
    });
  } catch (err) {
    console.error('Error analyzing legal risk:', err);
    return Response.json(
      {
        message: 'An error occurred while analyzing legal risk',
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};

// GET endpoint - Retrieve risk analysis history from PostgreSQL
export const GET = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const companyName = url.searchParams.get('company');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      return Response.json(
        {
          message: 'Database connection failed',
          analyses: [],
        },
        { status: 503 }
      );
    }

    // Build query
    let query = db
      .select()
      .from(riskAnalyses)
      .orderBy(desc(riskAnalyses.createdAt))
      .limit(limit)
      .offset(offset);

    // Filter by company name if provided
    if (companyName) {
      query = query.where(
        sql`LOWER(${riskAnalyses.companyName}) LIKE LOWER(${'%' + companyName + '%'})`
      );
    }

    const results = await query;

    // Get total count
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(riskAnalyses);
    
    if (companyName) {
      countQuery.where(
        sql`LOWER(${riskAnalyses.companyName}) LIKE LOWER(${'%' + companyName + '%'})`
      );
    }

    const totalCountResult = await countQuery;
    const totalCount = Number(totalCountResult[0]?.count || 0);

    return Response.json({
      success: true,
      total: totalCount,
      returned: results.length,
      analyses: results,
      storage: 'PostgreSQL',
      pagination: {
        hasMore: offset + limit < totalCount,
        nextOffset: offset + limit < totalCount ? offset + limit : null,
      },
    });
  } catch (err) {
    console.error('Error fetching risk analysis history:', err);
    return Response.json(
      {
        message: 'An error occurred while fetching risk analysis history',
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};