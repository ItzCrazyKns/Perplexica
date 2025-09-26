import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { eq, and, desc, lt } from 'drizzle-orm';
import { userMemories, memoryStats, memorySettings } from '../db/schema';
import {
  getMemoryEnabled,
  getMemoryProvider,
  getMemoryCloudConfig,
  getMemorySelfHostedConfig,
  getMemoryStorageConfig,
} from '../config';
import {
  MemoryItem,
  MemoryStats,
  MemorySettings,
  SearchMemoryOptions,
  AddMemoryOptions,
  UpdateMemoryOptions,
  MemorySearchResult,
  ConversationContext,
  MemoryContextResult,
  MemoryCloudConfig,
  MemorySelfHostedConfig,
} from './types';

// Mem0 imports
import MemoryClient from 'mem0ai';
import { Memory } from 'mem0ai/oss';

class MemoryService {
  private static instance: MemoryService;
  private memoryClient: MemoryClient | null = null;
  private ossMemory: Memory | null = null;
  private isInitialized = false;
  private enabled = false;
  private provider: string = 'cloud';

  private constructor() {
    this.initialize();
  }

  public static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  private async initialize() {
    try {
      this.enabled = getMemoryEnabled();
      if (!this.enabled) {
        console.log('Memory functionality disabled in configuration');
        return;
      }

      this.provider = getMemoryProvider();

      if (this.provider === 'cloud') {
        await this.initializeCloudMemory();
      } else if (this.provider === 'self-hosted') {
        await this.initializeSelfHostedMemory();
      }

      this.isInitialized = true;
      console.log(`Memory service initialized with provider: ${this.provider}`);
    } catch (error) {
      console.error('Failed to initialize memory service:', error);
      this.enabled = false;
    }
  }

  private async initializeCloudMemory() {
    const config = getMemoryCloudConfig() as MemoryCloudConfig;

    if (!config.API_KEY) {
      throw new Error('Mem0 API key not configured');
    }

    this.memoryClient = new MemoryClient({
      apiKey: config.API_KEY,
      organizationName: config.ORGANIZATION_NAME,
      projectName: config.PROJECT_NAME,
      organizationId: config.ORGANIZATION_ID,
      projectId: config.PROJECT_ID,
    });

    // Test the connection
    try {
      await this.memoryClient.getAll({ user_id: 'test_connection' });
      console.log('Successfully connected to mem0 cloud');
    } catch (error) {
      console.warn('Failed to connect to mem0 cloud service:', error.message);
      console.log('Memory service will continue with local storage only');
    }
  }

  private async initializeSelfHostedMemory() {
    const config = getMemorySelfHostedConfig() as MemorySelfHostedConfig;

    // Build mem0 configuration for self-hosted
    const memoryConfig: any = {
      version: 'v1.1',
      llm: {
        provider: config.LLM_PROVIDER.toLowerCase(),
        config: {
          model: config.LLM_MODEL,
        },
      },
      embedder: {
        provider: config.EMBEDDER_PROVIDER.toLowerCase(),
        config: {
          model: config.EMBEDDER_MODEL,
        },
      },
      vectorStore: {
        provider: config.VECTOR_STORE_PROVIDER.toLowerCase(),
        config: {
          collectionName: 'perplexica_memories',
        },
      },
    };

    // Add API keys if provided
    if (config.LLM_API_KEY) {
      memoryConfig.llm.config.apiKey = config.LLM_API_KEY;
    }

    if (config.EMBEDDER_API_KEY) {
      memoryConfig.embedder.config.apiKey = config.EMBEDDER_API_KEY;
    }

    if (config.VECTOR_STORE_URL) {
      memoryConfig.vectorStore.config.url = config.VECTOR_STORE_URL;
    }

    if (config.VECTOR_STORE_API_KEY) {
      memoryConfig.vectorStore.config.apiKey = config.VECTOR_STORE_API_KEY;
    }

    this.ossMemory = new Memory(memoryConfig);
  }

  public isEnabled(): boolean {
    return this.enabled && this.isInitialized;
  }

  public async addMemory(
    memory: string,
    options: AddMemoryOptions
  ): Promise<MemoryItem | null> {
    if (!this.isEnabled()) {
      console.warn('Memory service not enabled');
      return null;
    }

    try {
      const memoryId = uuidv4();
      const now = new Date().toISOString();

      // Store in mem0
      let mem0Id: string | undefined;

      if (this.provider === 'cloud' && this.memoryClient) {
        try {
          const messages = [{ role: 'user', content: memory }];
          const mem0Options: any = { user_id: options.userId };

          if (options.chatId) mem0Options.agent_id = options.chatId;
          if (options.sessionId) mem0Options.run_id = options.sessionId;

          const result = await this.memoryClient.add(messages as any, mem0Options);
          if (result && result.length > 0) {
            mem0Id = result[0].id;
          }
        } catch (error) {
          console.warn('Failed to add memory to mem0 cloud, storing locally only:', error.message);
        }
      } else if (this.provider === 'self-hosted' && this.ossMemory) {
        const result = await this.ossMemory.add(memory, {
          userId: options.userId,
          ...(options.chatId && { agentId: options.chatId }),
          ...(options.sessionId && { runId: options.sessionId }),
        });

        if (result.results && result.results.length > 0) {
          mem0Id = result.results[0].id;
        }
      }

      // Store in local database
      const memoryItem: MemoryItem = {
        id: memoryId,
        userId: options.userId,
        memoryType: options.memoryType,
        mem0Id,
        memory,
        metadata: options.metadata,
        chatId: options.chatId,
        sessionId: options.sessionId,
        createdAt: now,
        expiresAt: options.expiresAt,
      };

      await db.insert(userMemories).values({
        id: memoryId,
        userId: options.userId,
        memoryType: options.memoryType,
        mem0Id,
        memory,
        metadata: JSON.stringify(options.metadata || {}),
        chatId: options.chatId,
        sessionId: options.sessionId,
        createdAt: now,
        expiresAt: options.expiresAt,
      });

      // Update stats
      await this.updateUserStats(options.userId);

      return memoryItem;
    } catch (error) {
      console.error('Failed to add memory:', error);
      return null;
    }
  }

  public async searchMemories(
    query: string,
    options: SearchMemoryOptions
  ): Promise<MemorySearchResult> {
    if (!this.isEnabled()) {
      return { memories: [], totalCount: 0 };
    }

    try {
      // Search in mem0 first for relevant memories
      let relevantMem0Ids: string[] = [];

      if (this.provider === 'cloud' && this.memoryClient) {
        try {
          const searchOptions: any = { user_id: options.userId };

          if (options.chatId) searchOptions.agent_id = options.chatId;
          if (options.sessionId) searchOptions.run_id = options.sessionId;
          if (options.limit) searchOptions.limit = options.limit;

          const results = await this.memoryClient.search(query, searchOptions);
          relevantMem0Ids = results.map((r: any) => r.id);
        } catch (error) {
          console.warn('Failed to search mem0 cloud, falling back to local search:', error.message);
          // Continue with local search only
        }
      } else if (this.provider === 'self-hosted' && this.ossMemory) {
        const searchFilters: any = { userId: options.userId };

        if (options.chatId) searchFilters.agentId = options.chatId;
        if (options.sessionId) searchFilters.runId = options.sessionId;

        const result = await this.ossMemory.search(query, {
          limit: options.limit || 10,
          filters: searchFilters,
        });

        relevantMem0Ids = result.results.map((r: any) => r.id);
      }

      // Fetch corresponding local memories
      let localQuery = db.select().from(userMemories)
        .where(eq(userMemories.userId, options.userId));

      if (options.memoryType) {
        localQuery = localQuery.where(eq(userMemories.memoryType, options.memoryType));
      }

      if (options.chatId) {
        localQuery = localQuery.where(eq(userMemories.chatId, options.chatId));
      }

      if (options.sessionId) {
        localQuery = localQuery.where(eq(userMemories.sessionId, options.sessionId));
      }

      let allMemories = await localQuery.orderBy(desc(userMemories.createdAt));

      // Filter by mem0 results if available
      if (relevantMem0Ids.length > 0) {
        allMemories = allMemories.filter(memory =>
          memory.mem0Id && relevantMem0Ids.includes(memory.mem0Id)
        );
      }

      // Apply limit
      const limit = options.limit || 10;
      const memories = allMemories.slice(0, limit).map(this.mapDbToMemoryItem);

      return {
        memories,
        totalCount: allMemories.length,
      };
    } catch (error) {
      console.error('Failed to search memories:', error);
      return { memories: [], totalCount: 0 };
    }
  }

  public async updateMemory(
    memoryId: string,
    updates: UpdateMemoryOptions
  ): Promise<MemoryItem | null> {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const existing = await db.select().from(userMemories)
        .where(eq(userMemories.id, memoryId))
        .limit(1);

      if (existing.length === 0) {
        throw new Error('Memory not found');
      }

      const memory = existing[0];

      // Update in mem0 if memory text changed
      if (updates.memory && memory.mem0Id) {
        if (this.provider === 'cloud' && this.memoryClient) {
          await this.memoryClient.update(memory.mem0Id, {
            text: updates.memory,
            metadata: updates.metadata,
          });
        } else if (this.provider === 'self-hosted' && this.ossMemory) {
          await this.ossMemory.update(memory.mem0Id, updates.memory);
        }
      }

      // Update local database
      const now = new Date().toISOString();
      const updateData: any = {
        updatedAt: now,
      };

      if (updates.memory) updateData.memory = updates.memory;
      if (updates.metadata) updateData.metadata = JSON.stringify(updates.metadata);
      if (updates.expiresAt) updateData.expiresAt = updates.expiresAt;

      await db.update(userMemories)
        .set(updateData)
        .where(eq(userMemories.id, memoryId));

      // Fetch updated memory
      const updated = await db.select().from(userMemories)
        .where(eq(userMemories.id, memoryId))
        .limit(1);

      return updated.length > 0 ? this.mapDbToMemoryItem(updated[0]) : null;
    } catch (error) {
      console.error('Failed to update memory:', error);
      return null;
    }
  }

  public async deleteMemory(memoryId: string): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      const existing = await db.select().from(userMemories)
        .where(eq(userMemories.id, memoryId))
        .limit(1);

      if (existing.length === 0) {
        return false;
      }

      const memory = existing[0];

      // Delete from mem0
      if (memory.mem0Id) {
        if (this.provider === 'cloud' && this.memoryClient) {
          await this.memoryClient.delete(memory.mem0Id);
        } else if (this.provider === 'self-hosted' && this.ossMemory) {
          await this.ossMemory.delete(memory.mem0Id);
        }
      }

      // Delete from local database
      await db.delete(userMemories).where(eq(userMemories.id, memoryId));

      // Update stats
      await this.updateUserStats(memory.userId);

      return true;
    } catch (error) {
      console.error('Failed to delete memory:', error);
      return false;
    }
  }

  public async getMemoryContext(
    query: string,
    userId: string,
    chatId?: string,
    sessionId?: string
  ): Promise<MemoryContextResult> {
    if (!this.isEnabled()) {
      return {
        relevantMemories: [],
        contextSummary: '',
      };
    }

    try {
      // Search for relevant memories
      const searchResult = await this.searchMemories(query, {
        userId,
        chatId,
        sessionId,
        limit: 5,
      });

      // Build context summary
      const memoryTexts = searchResult.memories.map(m => m.memory);
      const contextSummary = memoryTexts.length > 0
        ? `Based on previous interactions: ${memoryTexts.join('. ')}`
        : '';

      return {
        relevantMemories: searchResult.memories,
        contextSummary,
      };
    } catch (error) {
      console.error('Failed to get memory context:', error);
      return {
        relevantMemories: [],
        contextSummary: '',
      };
    }
  }

  public async addConversationContext(
    context: ConversationContext
  ): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      // Extract meaningful information from conversation
      const conversationText = context.messages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      // Add as chat memory
      await this.addMemory(conversationText, {
        userId: context.userId,
        memoryType: 'chat',
        chatId: context.chatId,
        sessionId: context.sessionId,
        metadata: {
          focusMode: context.focusMode,
          timestamp: context.timestamp,
          messageCount: context.messages.length,
        },
      });
    } catch (error) {
      console.error('Failed to add conversation context:', error);
    }
  }

  public async cleanupExpiredMemories(): Promise<number> {
    if (!this.isEnabled()) {
      return 0;
    }

    try {
      const now = new Date().toISOString();

      // Find expired memories
      const expired = await db.select().from(userMemories)
        .where(and(
          lt(userMemories.expiresAt, now)
        ));

      // Delete expired memories
      for (const memory of expired) {
        await this.deleteMemory(memory.id);
      }

      console.log(`Cleaned up ${expired.length} expired memories`);
      return expired.length;
    } catch (error) {
      console.error('Failed to cleanup expired memories:', error);
      return 0;
    }
  }

  private async updateUserStats(userId: string): Promise<void> {
    try {
      // Count memories by type
      const allMemories = await db.select().from(userMemories)
        .where(eq(userMemories.userId, userId));

      const stats = {
        totalMemories: allMemories.length,
        userMemories: allMemories.filter(m => m.memoryType === 'user').length,
        sessionMemories: allMemories.filter(m => m.memoryType === 'session').length,
        chatMemories: allMemories.filter(m => m.memoryType === 'chat').length,
      };

      // Update or insert stats
      const existing = await db.select().from(memoryStats)
        .where(eq(memoryStats.userId, userId))
        .limit(1);

      const now = new Date().toISOString();

      if (existing.length > 0) {
        await db.update(memoryStats)
          .set({
            ...stats,
            updatedAt: now,
          })
          .where(eq(memoryStats.userId, userId));
      } else {
        await db.insert(memoryStats).values({
          userId,
          ...stats,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      console.error('Failed to update user stats:', error);
    }
  }

  private mapDbToMemoryItem(dbItem: any): MemoryItem {
    return {
      id: dbItem.id,
      userId: dbItem.userId,
      memoryType: dbItem.memoryType,
      mem0Id: dbItem.mem0Id,
      memory: dbItem.memory,
      metadata: dbItem.metadata ? JSON.parse(dbItem.metadata) : undefined,
      chatId: dbItem.chatId,
      sessionId: dbItem.sessionId,
      createdAt: dbItem.createdAt,
      updatedAt: dbItem.updatedAt,
      expiresAt: dbItem.expiresAt,
    };
  }

  public async getUserSettings(userId: string): Promise<MemorySettings | null> {
    try {
      const settings = await db.select().from(memorySettings)
        .where(eq(memorySettings.userId, userId))
        .limit(1);

      if (settings.length === 0) {
        // Create default settings
        const now = new Date().toISOString();
        const defaultSettings: MemorySettings = {
          userId,
          memoryEnabled: true,
          retentionDays: 365,
          maxMemories: 10000,
          autoCleanup: true,
          privacyLevel: 'medium',
          createdAt: now,
          updatedAt: now,
        };

        await db.insert(memorySettings).values(defaultSettings);
        return defaultSettings;
      }

      return settings[0] as MemorySettings;
    } catch (error) {
      console.error('Failed to get user settings:', error);
      return null;
    }
  }

  public async updateUserSettings(
    userId: string,
    updates: Partial<MemorySettings>
  ): Promise<MemorySettings | null> {
    try {
      const now = new Date().toISOString();

      await db.update(memorySettings)
        .set({
          ...updates,
          updatedAt: now,
        })
        .where(eq(memorySettings.userId, userId));

      return this.getUserSettings(userId);
    } catch (error) {
      console.error('Failed to update user settings:', error);
      return null;
    }
  }
}

export default MemoryService;