export type PhaseName = 'Plan' | 'Search' | 'Analyze' | 'Synthesize';

export type SessionManifest = {
  chatId: string;
  createdAt: string;
  updatedAt: string;
  status: 'running' | 'cancelled' | 'completed' | 'error';
  budgets: {
    wallClockMs: number;
    llmTurnsHard: number;
    llmTurnsSoft: number;
  };
  tokensByPhase: Partial<Record<PhaseName, number>>;
  llmTurnsUsed: number;
  counts: {
    candidates?: number;
    extractedDocs?: number;
    facts?: number;
    clusters?: number;
    evidenceItems?: number;
  };
  phases: Partial<
    Record<PhaseName, { startedAt?: string; completedAt?: string }>
  >;
  // Extended (optional) fields for richer state/telemetry
  relevantDocuments?: Array<{ url: string; title?: string }>;
  draftSections?: Array<{ title: string; bullets: string[] }>;
  confidenceBySection?: Record<string, number>;
};
