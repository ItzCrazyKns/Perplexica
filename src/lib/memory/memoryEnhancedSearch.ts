import { BaseMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import memoryService from './index';
import { buildMemoryPrompt, categorizeMemory } from './utils';
import { EventEmitter } from 'events';

export interface MemoryEnhancedSearchOptions {
  userId?: string;
  sessionId?: string;
  focusMode?: string;
  includeUserMemories?: boolean;
  includeSessionMemories?: boolean;
  memoryLimit?: number;
}

export class MemoryEnhancedSearchWrapper {
  constructor(
    private originalHandler: any,
    private handlerName: string
  ) {}

  async searchAndAnswer(
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
    systemInstructions: string,
    memoryOptions?: MemoryEnhancedSearchOptions
  ): Promise<EventEmitter> {
    let enhancedMessage = message;
    let enhancedSystemInstructions = systemInstructions;

    // Only enhance with memory if enabled and user is identified
    if (memoryService.isEnabled() && memoryOptions?.userId) {
      try {
        // Get relevant memories based on the query
        const memoryContext = await memoryService.getMemoryContext(
          message,
          memoryOptions.userId,
          undefined, // No specific chatId for search context
          memoryOptions.sessionId
        );

        if (memoryContext.relevantMemories.length > 0) {
          // Filter memories based on options
          let filteredMemories = memoryContext.relevantMemories;

          if (!memoryOptions.includeUserMemories) {
            filteredMemories = filteredMemories.filter(m => m.memoryType !== 'user');
          }

          if (!memoryOptions.includeSessionMemories) {
            filteredMemories = filteredMemories.filter(m => m.memoryType !== 'session');
          }

          // Apply limit
          const limit = memoryOptions.memoryLimit || 5;
          filteredMemories = filteredMemories.slice(0, limit);

          if (filteredMemories.length > 0) {
            // Enhance the message with memory context
            enhancedMessage = buildMemoryPrompt(message, filteredMemories);

            // Enhance system instructions with user context
            const userContext = this.buildUserContext(filteredMemories);
            if (userContext) {
              enhancedSystemInstructions = `${systemInstructions}\n\nUser Context: ${userContext}`;
            }
          }
        }

        // Store the search query as a session memory for future reference
        await memoryService.addMemory(message, {
          userId: memoryOptions.userId,
          memoryType: 'session',
          sessionId: memoryOptions.sessionId,
          metadata: {
            type: 'search_query',
            focusMode: memoryOptions.focusMode,
            handlerName: this.handlerName,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('Failed to enhance search with memory:', error);
        // Continue with original message if memory enhancement fails
      }
    }

    // Call the original search handler with potentially enhanced inputs
    const resultStream = await this.originalHandler.searchAndAnswer(
      enhancedMessage,
      history,
      llm,
      embeddings,
      optimizationMode,
      fileIds,
      enhancedSystemInstructions
    );

    // Wrap the result stream to capture search results for memory
    return this.wrapResultStream(
      resultStream,
      message,
      memoryOptions?.userId,
      memoryOptions?.sessionId,
      memoryOptions?.focusMode
    );
  }

  private buildUserContext(memories: Array<{ memory: string; memoryType: string }>): string {
    const userMemories = memories.filter(m => m.memoryType === 'user');
    const sessionMemories = memories.filter(m => m.memoryType === 'session');

    let context = '';

    if (userMemories.length > 0) {
      context += `User preferences and background: ${userMemories.map(m => m.memory).join('; ')}. `;
    }

    if (sessionMemories.length > 0) {
      context += `Recent session context: ${sessionMemories.map(m => m.memory).join('; ')}.`;
    }

    return context.trim();
  }

  private wrapResultStream(
    originalStream: EventEmitter,
    originalQuery: string,
    userId?: string,
    sessionId?: string,
    focusMode?: string
  ): EventEmitter {
    const wrappedStream = new EventEmitter();
    let sources: any[] = [];
    let response = '';

    // Forward all events from original stream
    originalStream.on('data', (data) => {
      const parsedData = JSON.parse(data);

      if (parsedData.type === 'sources') {
        sources = parsedData.data;
      } else if (parsedData.type === 'response') {
        response += parsedData.data;
      }

      // Forward the event
      wrappedStream.emit('data', data);
    });

    originalStream.on('end', async () => {
      // Store search results in memory if enabled and user identified
      if (memoryService.isEnabled() && userId && response) {
        try {
          // Store the search result as a session memory
          await memoryService.addMemory(
            `Search for "${originalQuery}" returned: ${response.substring(0, 500)}${response.length > 500 ? '...' : ''}`,
            {
              userId,
              memoryType: 'session',
              sessionId,
              metadata: {
                type: 'search_result',
                originalQuery,
                focusMode,
                handlerName: this.handlerName,
                sourcesCount: sources.length,
                sources: sources.slice(0, 3), // Store top 3 sources
                timestamp: new Date().toISOString(),
              },
            }
          );

          // If the search revealed user preferences, store them as user memory
          const userPrefs = this.extractUserPreferences(response);
          if (userPrefs.length > 0) {
            for (const pref of userPrefs) {
              await memoryService.addMemory(pref, {
                userId,
                memoryType: 'user',
                metadata: {
                  type: 'inferred_preference',
                  source: 'search_result',
                  timestamp: new Date().toISOString(),
                },
              });
            }
          }
        } catch (error) {
          console.error('Failed to store search results in memory:', error);
        }
      }

      wrappedStream.emit('end');
    });

    originalStream.on('error', (error) => {
      wrappedStream.emit('error', error);
    });

    return wrappedStream;
  }

  private extractUserPreferences(response: string): string[] {
    const preferences: string[] = [];

    // Look for patterns that might indicate user preferences
    const preferencePatterns = [
      /(?:you (?:might|may|could) (?:like|prefer|enjoy|be interested in)) (.+?)(?:\.|,|$)/gi,
      /(?:based on your (?:interest in|preference for)) (.+?)(?:\.|,|$)/gi,
      /(?:since you (?:like|prefer|enjoy)) (.+?)(?:\.|,|$)/gi,
    ];

    for (const pattern of preferencePatterns) {
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 5 && match[1].length < 100) {
          preferences.push(`User shows interest in ${match[1].trim()}`);
        }
      }
    }

    return preferences;
  }
}

export function createMemoryEnhancedHandler(
  originalHandler: any,
  handlerName: string
): MemoryEnhancedSearchWrapper {
  return new MemoryEnhancedSearchWrapper(originalHandler, handlerName);
}