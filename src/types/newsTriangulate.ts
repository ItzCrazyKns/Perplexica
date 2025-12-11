export type Lane = 'LEFT' | 'RIGHT' | 'CENTER' | 'UNKNOWN';

export interface NewsSource {
  id: string;
  url: string;
  title: string;
  snippet?: string;
  domain: string;
  timestamp?: string;
  sourceName?: string;
  lane?: Lane;
  credibilityScore?: number; // 0-1 scale, higher is better
  imageUrl?: string; // og:image or thumbnail from search results (safe for previews)
}

export interface NewsClaim {
  id: string;
  sourceId: string;
  lane?: Lane;
  text: string;
  who?: string;
  when?: string;
  where?: string;
  claimType?: 'fact' | 'opinion' | 'quote' | 'other';
  confidence?: 'low' | 'medium' | 'high';
  metadata?: Record<string, unknown>;
}

export interface ClaimCluster {
  clusterId: string;
  representativeText: string;
  supportingClaims: Array<{ claimId: string; sourceId: string; lane?: Lane }>;
  disagreeingClaims?: Array<{ claimId: string; sourceId: string; lane?: Lane }>;
  lanesCovered: Lane[];
  agreementLevel: 'high' | 'medium' | 'low';
}

export interface TriangulatedNewsResult {
  summary: string;
  sharedFacts: ClaimCluster[];
  conflicts: ClaimCluster[];
  uniqueAngles: ClaimCluster[];
  lanes: Array<{ lane: Lane; count: number }>;
  sources: NewsSource[];
}
