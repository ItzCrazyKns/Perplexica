import { Phase } from '../types/deepResearchPhase';

export type SessionManifest = {
  chatId: string;
  createdAt: string;
  updatedAt: string;
  status:
    | 'running'
    | 'cancelled'
    | 'completed'
    | 'error'
    | 'needs_clarification';
  budgets: {
    wallClockMs: number;
    llmTurnsHard: number;
    llmTurnsSoft: number;
  };
  tokensByPhase: Partial<Record<Phase, number>>;
  llmTurnsUsed: number;
  counts: {
    candidates?: number;
    extractedDocs?: number;
    facts?: number;
    clusters?: number;
    evidenceItems?: number;
  };
  phases: Partial<Record<Phase, { startedAt?: string; completedAt?: string }>>;
  // Extended (optional) fields for richer state/telemetry
  relevantDocuments?: Array<{ url: string; title?: string }>;
  draftSections?: Array<{ title: string; bullets: string[] }>;
  confidenceBySection?: Record<string, number>;
};
