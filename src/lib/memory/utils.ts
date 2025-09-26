import { ConversationContext } from './types';

export function extractConversationContext(
  messages: Array<{ role: string; content: string }>,
  userId: string,
  chatId?: string,
  sessionId?: string,
  focusMode?: string
): ConversationContext {
  return {
    userId,
    chatId,
    sessionId,
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    })),
    focusMode,
    timestamp: new Date().toISOString(),
  };
}

export function isMemoryWorthy(content: string): boolean {
  // Check if content is worth storing as memory
  if (content.length < 10) return false;

  // Skip system messages and simple responses
  const skipPatterns = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no)$/i,
    /^(what|how|why|when|where)\s+/i, // Simple questions without context
    /^(can you|could you|please)\s+/i, // Simple requests
  ];

  // Always store if it contains personal information
  const personalPatterns = [
    /my name is/i,
    /i am|i'm/i,
    /i like|i love|i prefer/i,
    /i work|i study/i,
    /my favorite/i,
    /i need|i want/i,
  ];

  if (personalPatterns.some(pattern => pattern.test(content))) {
    return true;
  }

  // Skip if matches skip patterns
  if (skipPatterns.some(pattern => pattern.test(content))) {
    return false;
  }

  // Store if content is substantial (longer than 50 characters)
  return content.length > 50;
}

export function extractUserPreferences(content: string): Record<string, any> {
  const preferences: Record<string, any> = {};

  // Extract interests
  const interestPatterns = [
    /i like (.+)/i,
    /i love (.+)/i,
    /i'm interested in (.+)/i,
    /i enjoy (.+)/i,
  ];

  for (const pattern of interestPatterns) {
    const match = content.match(pattern);
    if (match) {
      preferences.interests = preferences.interests || [];
      preferences.interests.push(match[1].trim());
    }
  }

  // Extract expertise
  const expertisePatterns = [
    /i work in (.+)/i,
    /i'm a (.+)/i,
    /i specialize in (.+)/i,
    /my field is (.+)/i,
  ];

  for (const pattern of expertisePatterns) {
    const match = content.match(pattern);
    if (match) {
      preferences.expertise = preferences.expertise || [];
      preferences.expertise.push(match[1].trim());
    }
  }

  // Extract preferences
  const preferencePatterns = [
    /i prefer (.+)/i,
    /i usually (.+)/i,
    /i typically (.+)/i,
  ];

  for (const pattern of preferencePatterns) {
    const match = content.match(pattern);
    if (match) {
      preferences.generalPreferences = preferences.generalPreferences || [];
      preferences.generalPreferences.push(match[1].trim());
    }
  }

  return preferences;
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateUserId(identifier?: string): string {
  if (identifier) {
    return `user_${identifier}`;
  }
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function shouldCleanupMemory(
  createdAt: string,
  retentionDays: number
): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > retentionDays;
}

export function categorizeMemory(content: string): 'user' | 'session' | 'chat' {
  // Personal information should be user-level
  const personalPatterns = [
    /my name is/i,
    /i am|i'm/i,
    /i work|i study/i,
    /my favorite/i,
    /i like|i love|i prefer/i,
  ];

  if (personalPatterns.some(pattern => pattern.test(content))) {
    return 'user';
  }

  // Session-level for current context
  const sessionPatterns = [
    /in this session/i,
    /for now/i,
    /currently/i,
    /at the moment/i,
  ];

  if (sessionPatterns.some(pattern => pattern.test(content))) {
    return 'session';
  }

  // Default to chat-level
  return 'chat';
}

export function prioritizeMemories(
  memories: Array<{ memory: string; createdAt: string; metadata?: any }>
): Array<{ memory: string; createdAt: string; metadata?: any; priority: number }> {
  return memories.map(memory => ({
    ...memory,
    priority: calculateMemoryPriority(memory.memory, memory.createdAt, memory.metadata),
  })).sort((a, b) => b.priority - a.priority);
}

function calculateMemoryPriority(
  content: string,
  createdAt: string,
  metadata?: any
): number {
  let priority = 0;

  // Recency boost (more recent = higher priority)
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  priority += Math.max(0, 100 - daysSinceCreation);

  // Personal information boost
  const personalPatterns = [
    /my name is/i,
    /i am|i'm/i,
    /i like|i love|i prefer/i,
  ];
  if (personalPatterns.some(pattern => pattern.test(content))) {
    priority += 50;
  }

  // Length boost (more substantial content)
  priority += Math.min(20, content.length / 10);

  // Metadata boost
  if (metadata?.important) {
    priority += 30;
  }

  return priority;
}

export function buildMemoryPrompt(
  query: string,
  memories: Array<{ memory: string; createdAt: string }>
): string {
  if (memories.length === 0) {
    return query;
  }

  const memoryContext = memories
    .map(m => `- ${m.memory}`)
    .join('\n');

  return `Based on our previous conversations:
${memoryContext}

Current query: ${query}`;
}