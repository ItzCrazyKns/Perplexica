import path from 'node:path';
import configManager from '@/lib/config';
import ModelRegistry from '@/lib/models/registry';
import BaseLLM from '@/lib/models/base/llm';
import BaseEmbedding from '@/lib/models/base/embedding';
import TransformerEmbedding from '@/lib/models/providers/transformers/transformerEmbedding';
import { OrchestratorConfig } from './orchestrator';

export type RuntimeOverrides = {
  chatProviderId?: string;
  chatModelKey?: string;
};

export async function buildOrchestratorConfig(
  overrides: RuntimeOverrides = {},
): Promise<OrchestratorConfig> {
  const pa = configManager.getCurrentConfig().priorart ?? {};
  if (!pa.usptoOdpApiKey) {
    throw new Error(
      `Prior Art mode is missing required config: usptoOdpApiKey. Set it in Settings → Prior Art or via env.`,
    );
  }
  const bigqueryEnabled = Boolean(pa.gcpProjectId);
  if (!bigqueryEnabled) {
    console.warn(
      '[priorart] gcpProjectId not set — running USPTO-only. Add GCP_PROJECT_ID to enable Google Patents BigQuery.',
    );
  }

  const registry = new ModelRegistry();
  const llm = await loadChatLLM(registry, overrides);
  const embedder = makeEmbedder(pa.embeddingModel ?? 'Xenova/all-MiniLM-L6-v2');

  const dataDir = process.env.DATA_DIR || process.cwd();
  const workspaceRoot = path.isAbsolute(pa.workspacePath)
    ? pa.workspacePath
    : path.join(dataDir, pa.workspacePath);
  const vectorStoreRoot = path.isAbsolute(pa.vectorStorePath)
    ? pa.vectorStorePath
    : path.join(dataDir, pa.vectorStorePath);

  const cpcWhitelist = splitCsv(pa.cpcWhitelist);
  const uspcWhitelist = splitCsv(pa.uspcWhitelist);

  return {
    llm,
    embedder,
    uspto: {
      apiKey: pa.usptoOdpApiKey,
      baseUrl: pa.usptoOdpBaseUrl,
      legacyBaseUrl: pa.usptoOdpLegacyBaseUrl,
      oaUseLegacyHost: Boolean(pa.oaUseLegacyHost),
      requestTimeoutMs: Number(pa.requestTimeoutSeconds ?? 30) * 1000,
      uspcWhitelist: uspcWhitelist.length ? uspcWhitelist : undefined,
    },
    bigquery: bigqueryEnabled
      ? {
          projectId: pa.gcpProjectId,
          credentialsPath: pa.gcpCredentialsPath || undefined,
          dataset: pa.bigqueryPatentsDataset,
          bytesBilledCap: Number(pa.bigqueryBytesBilledCap ?? 1_000_000_000),
          cpcWhitelist: cpcWhitelist.length ? cpcWhitelist : undefined,
        }
      : undefined,
    workspaceRoot,
    vectorStoreRoot,
    maxResultsPerSource: Number(pa.maxResultsPerSource ?? 50),
    maxDocumentsToEmbed: Number(pa.maxDocumentsToEmbed ?? 200),
    embeddingDimension: Number(pa.embeddingDimension ?? 1024),
    topK: Number(pa.topK ?? 20),
    coverageThreshold: Number(pa.coverageThreshold ?? 0.55),
    enableDeepResearchReframe:
      pa.enableDeepResearchReframe === undefined
        ? true
        : Boolean(pa.enableDeepResearchReframe),
    deepResearchReframeModel: pa.deepResearchReframeModel || 'gemini-2.5-pro',
    geminiApiKey: process.env.GEMINI_API_KEY || undefined,
  };
}

async function loadChatLLM(
  registry: ModelRegistry,
  overrides: RuntimeOverrides,
): Promise<BaseLLM<unknown>> {
  if (overrides.chatProviderId && overrides.chatModelKey) {
    return registry.loadChatModel(overrides.chatProviderId, overrides.chatModelKey);
  }
  const active = await registry.getActiveProviders();
  // Prior Art needs a large output budget (Switchyard-size feature profiles
  // can exceed 8K tokens). Prefer "pro" / "opus" / "large" / "70b" / "405b"
  // tier models when available, fall back to first non-error model.
  const tierPattern = /\b(pro|opus|large|ultra|70b|405b|1\.5-pro|2\.5-pro|2-pro)\b/i;
  for (const p of active) {
    const preferred = p.chatModels.find(
      (m) => m.key !== 'error' && tierPattern.test(`${m.name} ${m.key}`),
    );
    if (preferred) {
      console.log(`[priorart] selected chat model: ${preferred.name} (${preferred.key})`);
      return registry.loadChatModel(p.id, preferred.key);
    }
  }
  for (const p of active) {
    if (p.chatModels.length && p.chatModels[0].key !== 'error') {
      console.log(`[priorart] fallback chat model: ${p.chatModels[0].name}`);
      return registry.loadChatModel(p.id, p.chatModels[0].key);
    }
  }
  throw new Error('No chat model providers are configured. Add one in Settings.');
}

function splitCsv(s: unknown): string[] {
  if (typeof s !== 'string' || !s.length) return [];
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

function makeEmbedder(model: string): BaseEmbedding<unknown> {
  return new TransformerEmbedding({ model }) as unknown as BaseEmbedding<unknown>;
}
