# Memory Integration with Mem0

This document describes the integration of Mem0 memory capabilities into Perplexica, enabling persistent, intelligent memory across user sessions and conversations.

## Overview

The memory integration adds three levels of memory to Perplexica:

- **User Memory**: Persistent across all sessions (preferences, interests, expertise)
- **Session Memory**: Temporary memory for current search session
- **Chat Memory**: Conversation-specific context and history

## Configuration

### 1. Environment Setup

Add the mem0 dependency to your project:

```bash
npm install mem0ai
```

### 2. Configuration Options

Update your `config.toml` file with memory settings:

```toml
[MEMORY]
ENABLED = true
PROVIDER = "cloud" # or "self-hosted"

# For Mem0 Cloud
[MEMORY.CLOUD]
API_KEY = "your-mem0-api-key"
ORGANIZATION_NAME = "your-org"  # Optional
PROJECT_NAME = "your-project"   # Optional

# For Self-Hosted Mem0
[MEMORY.SELF_HOSTED]
EMBEDDER_PROVIDER = "openai"
EMBEDDER_MODEL = "text-embedding-3-small"
EMBEDDER_API_KEY = "your-openai-key"

VECTOR_STORE_PROVIDER = "chroma"
VECTOR_STORE_URL = ""
VECTOR_STORE_API_KEY = ""

LLM_PROVIDER = "openai"
LLM_MODEL = "gpt-4o-mini"
LLM_API_KEY = "your-openai-key"

# Storage Settings
[MEMORY.STORAGE]
RETENTION_DAYS = 365
MAX_MEMORIES_PER_USER = 10000
AUTO_CLEANUP = true
```

## Architecture

### Memory Service Layer

The core memory functionality is implemented in `/src/lib/memory/`:

- `memoryService.ts`: Main service class handling all memory operations
- `types.ts`: TypeScript interfaces and types
- `utils.ts`: Utility functions for memory processing
- `memoryEnhancedSearch.ts`: Search enhancement with memory context

### Database Schema

New tables added to support memory functionality:

```sql
-- User memories table
CREATE TABLE user_memories (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  memoryType TEXT NOT NULL, -- 'user', 'session', 'chat'
  mem0Id TEXT,              -- Reference to mem0 memory ID
  memory TEXT NOT NULL,
  metadata TEXT,            -- JSON metadata
  chatId TEXT,              -- Link to specific chat
  sessionId TEXT,           -- Link to specific session
  createdAt TEXT NOT NULL,
  updatedAt TEXT,
  expiresAt TEXT            -- For session memories
);

-- Memory statistics
CREATE TABLE memory_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  totalMemories INTEGER DEFAULT 0,
  userMemories INTEGER DEFAULT 0,
  sessionMemories INTEGER DEFAULT 0,
  chatMemories INTEGER DEFAULT 0,
  lastCleanup TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- User memory settings
CREATE TABLE memory_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL UNIQUE,
  memoryEnabled BOOLEAN DEFAULT true,
  retentionDays INTEGER DEFAULT 365,
  maxMemories INTEGER DEFAULT 10000,
  autoCleanup BOOLEAN DEFAULT true,
  privacyLevel TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

## API Endpoints

### Memory Management

- `GET /api/memory`: Get all memories for a user
- `POST /api/memory`: Add a new memory
- `DELETE /api/memory`: Delete all memories for user/session/chat
- `GET /api/memory/[id]`: Get a specific memory
- `PUT /api/memory/[id]`: Update a specific memory
- `DELETE /api/memory/[id]`: Delete a specific memory

### Memory Search

- `POST /api/memory/search`: Search memories with natural language queries

### Memory Settings

- `GET /api/memory/settings`: Get user's memory settings
- `PUT /api/memory/settings`: Update user's memory settings

### Memory Statistics

- `GET /api/memory/stats`: Get memory statistics for a user
- `POST /api/memory/cleanup`: Clean up expired memories

## Usage Examples

### Adding Memory

```typescript
import memoryService from '@/lib/memory';

// Add a user preference
await memoryService.addMemory(
  "I prefer academic articles over blog posts",
  {
    userId: "user123",
    memoryType: "user",
    metadata: { type: "preference", category: "content" }
  }
);

// Add session context
await memoryService.addMemory(
  "Currently researching machine learning algorithms",
  {
    userId: "user123",
    memoryType: "session",
    sessionId: "session_abc",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }
);
```

### Searching Memories

```typescript
// Search for relevant memories
const searchResult = await memoryService.searchMemories(
  "machine learning resources",
  {
    userId: "user123",
    memoryType: "user", // Optional: filter by type
    limit: 5
  }
);

console.log("Relevant memories:", searchResult.memories);
```

### Memory-Enhanced Search

The search system automatically incorporates relevant memories:

```typescript
// Enhanced search query with memory context
const memoryContext = await memoryService.getMemoryContext(
  "explain neural networks",
  "user123"
);

// Context includes user preferences and past interactions
const enhancedQuery = buildMemoryPrompt(
  "explain neural networks",
  memoryContext.relevantMemories
);
```

## Privacy and Security

### Privacy Levels

- **High Privacy**: Minimal data collection, memories expire quickly
- **Medium Privacy**: Balanced approach with configurable retention
- **Low Privacy**: Maximum memory retention for enhanced personalization

### Data Protection

- All memory data is encrypted at rest
- User can delete all memories at any time
- Automatic cleanup of expired memories
- Granular control over memory types and retention

### GDPR Compliance

- User consent required for memory collection
- Right to access all stored memories
- Right to delete all personal data
- Data export functionality

## Memory Types and Use Cases

### User Memory
- Personal preferences and interests
- Professional background and expertise
- Language and communication style preferences
- Accessibility requirements

### Session Memory
- Current research topic or project
- Temporary preferences for current session
- Context from current conversation thread
- Focus mode preferences

### Chat Memory
- Specific conversation context
- Referenced documents and sources
- Follow-up questions and clarifications
- User satisfaction feedback

## Integration Points

### Chat API Enhancement

The chat API (`/api/chat/route.ts`) is enhanced to:
1. Extract memory context before generating responses
2. Store conversation outcomes as memories
3. Adapt responses based on user history

### Search Agent Enhancement

All search agents are wrapped with memory enhancement:
1. User preferences influence search strategies
2. Past search results inform current queries
3. Search patterns are learned and optimized

### Frontend Integration

Memory settings are integrated into the settings page:
- Toggle memory functionality on/off
- Configure retention and privacy settings
- View memory statistics and manage stored data

## Troubleshooting

### Common Issues

1. **Memory service not enabled**
   - Check `MEMORY.ENABLED` in config.toml
   - Verify API keys are correctly configured

2. **Mem0 connection errors**
   - For cloud: Verify API key and organization settings
   - For self-hosted: Check embedder, vector store, and LLM configurations

3. **Memory not persisting**
   - Check database permissions
   - Verify user ID consistency across requests

4. **Performance issues**
   - Consider reducing memory limit per user
   - Enable automatic cleanup for expired memories
   - Monitor vector store performance

### Debug Commands

```bash
# Reset all memory data
npm run memory:reset

# Export memory data for analysis
npm run memory:export [userId]

# View memory statistics
curl "http://localhost:3000/api/memory/stats?userId=user123"

# Test memory search
curl -X POST "http://localhost:3000/api/memory/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning", "userId": "user123"}'
```

## Performance Considerations

### Optimization Strategies

1. **Memory Limits**: Set reasonable limits per user (default: 10,000)
2. **Retention Policies**: Configure automatic cleanup of old memories
3. **Indexing**: Ensure proper database indexes for memory queries
4. **Caching**: Consider Redis for frequently accessed memories
5. **Batch Processing**: Process memory updates in batches

### Monitoring

Monitor the following metrics:
- Memory retrieval latency
- Storage usage per user
- Memory search accuracy
- User engagement with memory features

## Future Enhancements

### Planned Features

1. **Memory Clustering**: Group related memories automatically
2. **Memory Importance Scoring**: Prioritize important memories
3. **Cross-User Memory Sharing**: Share anonymized insights
4. **Memory Analytics**: Advanced analytics for memory patterns
5. **Memory Suggestions**: Proactive memory suggestions
6. **Integration APIs**: Connect with external knowledge bases

### Extension Points

The memory system is designed to be extensible:
- Custom memory types
- Third-party vector stores
- Advanced privacy controls
- Multi-tenant memory isolation
- Memory federation across instances

## Contributing

To contribute to the memory integration:

1. Follow the existing code patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Consider privacy implications
5. Test with both cloud and self-hosted configurations

For questions or issues, please refer to the main Perplexica repository or create an issue with the `memory` label.