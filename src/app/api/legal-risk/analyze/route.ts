// Risk level definitions
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface RiskAnalysisRequest {
  companyName: string;
  industry?: string;
  description?: string;
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
  timestamp: string;
}

// Temporary in-memory storage for risk analyses
const riskAnalysisHistory: RiskAnalysisResponse[] = [];

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

    // Create response
    const analysis: RiskAnalysisResponse = {
      companyName: body.companyName,
      riskLevel,
      riskScore,
      categories,
      factors,
      recommendations,
      timestamp: new Date().toISOString(),
    };

    // Store in history (keep last 100 analyses)
    riskAnalysisHistory.push(analysis);
    if (riskAnalysisHistory.length > 100) {
      riskAnalysisHistory.shift();
    }

    return Response.json({
      success: true,
      analysis,
      message: `Risk analysis completed for ${body.companyName}`,
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

// GET endpoint - Retrieve risk analysis history
export const GET = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const companyName = url.searchParams.get('company');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    let results = [...riskAnalysisHistory];

    // Filter by company name if provided
    if (companyName) {
      results = results.filter(
        analysis => analysis.companyName.toLowerCase().includes(companyName.toLowerCase())
      );
    }

    // Sort by timestamp (newest first) and limit
    results = results
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, Math.min(limit, 100));

    return Response.json({
      success: true,
      total: riskAnalysisHistory.length,
      returned: results.length,
      analyses: results,
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