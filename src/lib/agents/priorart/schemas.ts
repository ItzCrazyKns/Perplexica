import z from 'zod';

export const technicalElementSchema = z.object({
  name: z.string().describe('Short label for the element.'),
  description: z.string().describe('1–2 sentence description of the element.'),
  noveltyHypothesis: z
    .string()
    .describe('Why this element might be novel; what prior art it improves over.'),
});

export const featureProfileSchema = z.object({
  featureId: z.string().describe('Stable kebab-case id derived from the title.'),
  title: z.string(),
  summary: z.string(),
  technicalElements: z.array(technicalElementSchema).min(1),
  cpcClassesSuggested: z.array(z.string()).describe('LLM-suggested CPC classes; not validated against schedule in v1.'),
  keywordClusters: z
    .array(z.object({ label: z.string(), terms: z.array(z.string()).min(1) }))
    .min(1),
  semanticQueries: z.array(z.string()).min(1),
  componentTechnologies: z.array(z.string()).describe('e.g. "vector similarity search", "merkle-tree state commitment".'),
});
export type FeatureProfile = z.infer<typeof featureProfileSchema>;

export const booleanQuerySchema = z.object({
  field: z.enum(['title', 'abstract', 'claims', 'fullText', 'any']),
  query: z.string().describe('Boolean query with AND/OR/NOT and quoted phrases.'),
});

export const bigqueryFragmentSchema = z.object({
  whereClause: z.string().describe('SQL WHERE fragment, parameterized — uses @p0/@p1/... placeholders.'),
  params: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['STRING', 'INT64', 'FLOAT64', 'BOOL', 'DATE']),
      value: z.union([z.string(), z.number(), z.boolean()]),
      array: z.boolean().nullable().optional(),
    }),
  ),
});

export const queryPlanSchema = z.object({
  odpQueries: z.array(booleanQuerySchema).min(1),
  bigqueryFragments: z.array(bigqueryFragmentSchema).min(1),
  semanticQueries: z.array(z.string()).min(1),
  cpcClasses: z.array(z.string()),
  priorityDate: z.string().describe('ISO date YYYY-MM-DD; cutoff for §102 strict-before filter.'),
});
export type QueryPlan = z.infer<typeof queryPlanSchema>;

export const patentDocumentSchema = z.object({
  publicationNumber: z.string(),
  applicationNumber: z.string().optional(),
  title: z.string(),
  abstract: z.string().optional(),
  firstIndependentClaim: z.string().optional(),
  filingDate: z.string().optional(),
  publicationDate: z.string().optional(),
  priorityDate: z.string().optional(),
  assignees: z.array(z.string()).default([]),
  inventors: z.array(z.string()).default([]),
  cpcCodes: z.array(z.string()).default([]),
  ipcCodes: z.array(z.string()).default([]),
  citationCount: z.number().optional(),
  source: z.enum(['uspto_odp', 'bigquery_patents']),
  raw: z.record(z.string(), z.unknown()).optional(),
});
export type PatentDocument = z.infer<typeof patentDocumentSchema>;

export const rankedDocumentSchema = patentDocumentSchema.extend({
  fusedScore: z.number(),
  sourceRanks: z.record(z.string(), z.number()),
});
export type RankedDocument = z.infer<typeof rankedDocumentSchema>;

export const claimElementSchema = z.object({
  label: z.string().describe('e.g. "1[a]" or short element name.'),
  text: z.string(),
});

export const elementMappingSchema = z.object({
  elementLabel: z.string(),
  referencePublicationNumber: z.string(),
  pinpoint: z.string().describe('column/line for US patents, paragraph number for publications.'),
  excerpt: z.string(),
  notes: z.string().nullable().optional(),
});

export const claimChartSchema = z.object({
  claimText: z.string(),
  elements: z.array(claimElementSchema).min(1),
  mappings: z.array(elementMappingSchema),
});
export type ClaimChart = z.infer<typeof claimChartSchema>;

export const assigneeStatSchema = z.object({
  name: z.string(),
  count: z.number(),
  earliestFiling: z.string().nullable().optional(),
  latestFiling: z.string().nullable().optional(),
});

export const cpcStatSchema = z.object({
  code: z.string(),
  count: z.number(),
});

export const landscapeSchema = z.object({
  topAssignees: z.array(assigneeStatSchema),
  cpcDistribution: z.array(cpcStatSchema),
  highlyCitedReferences: z.array(
    z.object({ publicationNumber: z.string(), citationCount: z.number() }),
  ),
  citationClusters: z.array(z.object({ label: z.string(), members: z.array(z.string()) })),
  whitespaceCandidates: z.array(z.string()),
});
export type Landscape = z.infer<typeof landscapeSchema>;

export const elementCoverageSchema = z.object({
  label: z.string().describe('Stable element id, server-assigned (e.g. "E1").'),
  name: z.string(),
  hitCount: z.number(),
  maxSimilarity: z.number(),
  novelty: z.enum(['likely_novel', 'partial', 'anticipated_risk']),
  matchingRefs: z.array(
    z.object({
      publicationNumber: z.string(),
      similarity: z.number(),
    }),
  ),
});
export type ElementCoverage = z.infer<typeof elementCoverageSchema>;

export const primaryReferenceSchema = z.object({
  publicationNumber: z.string(),
  title: z.string(),
  elementCoverageFraction: z.number(),
  coveredElements: z.array(z.string()),
  distinguishingElements: z.array(z.string()),
});
export type PrimaryReference = z.infer<typeof primaryReferenceSchema>;

export type LabeledTechnicalElement = z.infer<typeof technicalElementSchema> & {
  label: string;
};

export const reframePillarSchema = z.object({
  pillar: z.string(),
  domainContext: z.string(),
  relatedKnownArt: z.array(z.string()),
});

export const reframeNonPatentSchema = z.object({
  type: z.enum(['arxiv', 'github', 'standard', 'product', 'blog', 'paper']),
  title: z.string(),
  url: z.string(),
  relevance: z.string(),
});

export const reframeAmbiguousTermSchema = z.object({
  term: z.string(),
  intendedMeaning: z.string(),
  collisions: z.array(z.string()),
});

export const memoPatentableEdgeSchema = z.object({
  pillar: z.string(),
  priorArtSummaries: z.array(z.object({ art: z.string(), teaching: z.string() })),
  combinationEdge: z.string(),
  emergentProperty: z.string(),
  suggestedClaimLanguage: z.string(),
  benchmarkDelta: z.string().nullable().optional(),
  strength: z.enum(['strong', 'moderate', 'weak']),
});
export type MemoPatentableEdge = z.infer<typeof memoPatentableEdgeSchema>;

export const memoReframeSchema = z.object({
  trueTechnicalPillars: z.array(reframePillarSchema),
  nonPatentPriorArt: z.array(reframeNonPatentSchema),
  refinedUsptoQueries: z.array(z.string()),
  refinedCpcClasses: z.array(z.string()),
  noiseDomainsToAvoid: z.array(z.string()),
  ambiguousTerms: z.array(reframeAmbiguousTermSchema),
});
export type MemoReframe = z.infer<typeof memoReframeSchema>;

export const memoSkeletonSchema = z.object({
  featureDescription: z.string(),
  searchStrategy: z.object({
    cpcClasses: z.array(z.string()),
    keywordClusters: z.array(z.string()),
    priorityDate: z.string(),
    sources: z.array(z.string()),
  }),
  reframe: memoReframeSchema.nullable().default(null),
  landscapeFindings: landscapeSchema,
  referencesOfInterest: z.array(
    z.object({
      publicationNumber: z.string(),
      title: z.string(),
      relevanceNote: z.string(),
    }),
  ),
  elementCoverage: z.array(elementCoverageSchema).default([]),
  primaryReference: primaryReferenceSchema.nullable().default(null),
  patentableEdges: z.array(memoPatentableEdgeSchema).default([]),
  claimChart: claimChartSchema.nullable(),
  openQuestionsForCounsel: z.array(z.string()),
  verificationWarnings: z.array(z.string()).default([]),
});
export type MemoSkeleton = z.infer<typeof memoSkeletonSchema>;

export const MEMO_DISCLAIMER =
  'Research artifact, not legal opinion. Counsel review required.';
