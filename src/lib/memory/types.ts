export interface MemoryItem {
  id: string;
  userId: string;
  memoryType: 'user' | 'session' | 'chat';
  mem0Id?: string;
  memory: string;
  metadata?: Record<string, any>;
  chatId?: string;
  sessionId?: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
}

export interface MemoryStats {
  id?: number;
  userId: string;
  totalMemories: number;
  userMemories: number;
  sessionMemories: number;
  chatMemories: number;
  lastCleanup?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySettings {
  id?: number;
  userId: string;
  memoryEnabled: boolean;
  retentionDays: number;
  maxMemories: number;
  autoCleanup: boolean;
  privacyLevel: 'high' | 'medium' | 'low';
  createdAt: string;
  updatedAt: string;
}

export interface SearchMemoryOptions {
  userId: string;
  sessionId?: string;
  chatId?: string;
  memoryType?: 'user' | 'session' | 'chat';
  limit?: number;
}

export interface AddMemoryOptions {
  userId: string;
  memoryType: 'user' | 'session' | 'chat';
  chatId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  expiresAt?: string;
}

export interface UpdateMemoryOptions {
  memory?: string;
  metadata?: Record<string, any>;
  expiresAt?: string;
}

export interface MemorySearchResult {
  memories: MemoryItem[];
  relevanceScores?: number[];
  totalCount: number;
}

export interface MemoryCloudConfig {
  API_KEY: string;
  ORGANIZATION_NAME?: string;
  PROJECT_NAME?: string;
  ORGANIZATION_ID?: string;
  PROJECT_ID?: string;
}

export interface MemorySelfHostedConfig {
  EMBEDDER_PROVIDER: string;
  EMBEDDER_MODEL: string;
  EMBEDDER_API_KEY?: string;
  VECTOR_STORE_PROVIDER: string;
  VECTOR_STORE_URL?: string;
  VECTOR_STORE_API_KEY?: string;
  LLM_PROVIDER: string;
  LLM_MODEL: string;
  LLM_API_KEY?: string;
}

export interface MemoryStorageConfig {
  RETENTION_DAYS: number;
  MAX_MEMORIES_PER_USER: number;
  AUTO_CLEANUP: boolean;
}

export interface ConversationContext {
  userId: string;
  chatId?: string;
  sessionId?: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  focusMode?: string;
  timestamp: string;
}

export interface MemoryContextResult {
  relevantMemories: MemoryItem[];
  contextSummary: string;
  userProfile?: {
    interests: string[];
    expertise: string[];
    preferences: Record<string, any>;
  };
}