# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Perplexica is an open-source AI-powered search engine built with Next.js 15, TypeScript, and LangChain. It uses SearxNG for web searches and combines LLMs with similarity search to provide cited, accurate answers.

## Development Commands

### Running the Application

**Docker (Recommended)**:
```bash
docker compose up -d          # Start all services
docker compose down           # Stop all services
docker compose logs -f app    # View app logs
```

**Non-Docker Development**:
```bash
npm install                   # Install dependencies
npm run build                 # Build application (runs migrations first)
npm run dev                   # Start development server
npm start                     # Start production server
```

### Database

```bash
npm run db:migrate            # Run database migrations
```

### Code Quality

```bash
npm run lint                  # Run ESLint
npm run format:write          # Format code with Prettier
```

### Important: Process Management

**CRITICAL**: Never use `kill <PID>` to stop processes. This can crash the system. Instead:
- For Docker containers: Use `docker compose down` or stop by container name
- For local processes: Find and kill by port using `lsof -ti:PORT | xargs kill -9`

Example: To stop a process running on port 3000:
```bash
lsof -ti:3000 | xargs kill -9
```

## Architecture

### Core Components

1. **Next.js App Router** (`src/app/`): Server-side rendering, API routes, and pages
2. **LangChain Agents** (`src/lib/search/`, `src/lib/chains/`): Search orchestration and query processing
3. **LLM Providers** (`src/lib/providers/`): Abstraction layer for multiple LLM providers (OpenAI, Anthropic, Ollama, Groq, Gemini, Deepseek, LM Studio, Lemonade, AI/ML API)
4. **Embedding & Reranking** (`src/lib/utils/computeSimilarity.ts`): Similarity search using cosine/dot product
5. **SearxNG Integration** (`src/lib/searxng.ts`): Web search via metasearch engine
6. **Database** (`src/lib/db/`): SQLite with Drizzle ORM for chat history and settings

### Search Flow

The main search flow (using `webSearch` focus mode):

1. User query → `/api/chat` route
2. Query processed by `MetaSearchAgent` (`src/lib/search/metaSearchAgent.ts`)
3. Agent determines if web search needed and generates optimized search query
4. SearxNG searches web → returns results
5. Results converted to embeddings and reranked by similarity
6. Top sources passed to LLM for response generation
7. Streamed response with citations sent to UI

### Focus Modes

Focus modes are specialized search configurations in `src/lib/prompts/`:
- **All Mode**: General web search
- **Writing Assistant**: No web search, pure LLM generation
- **Academic Search**: Searches academic sources
- **YouTube Search**: Video-specific search
- **Wolfram Alpha**: Mathematical/computational queries
- **Reddit Search**: Discussion-focused search

Each mode configures different prompts, search engines, and reranking strategies.

### API Routes

All routes in `src/app/api/`:
- `/api/chat` - Main chat/search endpoint
- `/api/search` - Direct search API
- `/api/images` - Image search
- `/api/videos` - Video search
- `/api/models` - List available LLM models
- `/api/config` - App configuration
- `/api/chats` - Chat history CRUD
- `/api/suggestions` - Query suggestions
- `/api/discover` - Discovery features
- `/api/uploads` - File upload handling

## Configuration

Configuration is managed via `config.toml` (based on `sample.config.toml`):

- **LLM Providers**: Configure API keys and endpoints for various providers
- **Docker URLs**: Use `host.docker.internal` for accessing host machine services
- **SearxNG**: Typically runs on port 4000 in Docker, 32768 locally
- **Similarity Measure**: `cosine` or `dot` for embedding comparison

Path aliases use `@/*` for `src/*` (configured in `tsconfig.json`).

## Database Schema

Located in `src/lib/db/schema.ts` using Drizzle ORM:
- Stores chat conversations and messages
- Settings and preferences
- User uploaded file metadata

Migrations run automatically on build via `npm run db:migrate`.

## Working with LLM Providers

When adding or modifying provider support:

1. Create provider file in `src/lib/providers/`
2. Implement `load{Provider}ChatModels` and/or `load{Provider}EmbeddingModels`
3. Export `PROVIDER_INFO` with metadata
4. Register in `src/lib/providers/index.ts`
5. Add configuration section to `sample.config.toml`

Temperature-restricted models (o1, o3, DeepSeek reasoning models) should not have temperature set.

## Testing Workflow

No automated tests are currently configured. Manual testing workflow:

1. Start development environment (Docker or local)
2. Test in browser at `http://localhost:3000`
3. Check API routes directly if needed
4. Monitor logs for errors

## File Uploads

User files are stored in `uploads/` directory with:
- Original file
- `-extracted.json` - Extracted text content
- `-embeddings.json` - Pre-computed embeddings for similarity search

The system supports various document formats (PDF, DOCX, TXT, etc.) via LangChain document loaders.

## Deployment

The application is designed for Docker deployment with two services:
- `searxng`: Metasearch engine (port 4000 → 8080)
- `app`: Next.js application (port 3000)

Environment variables can be set via `config.toml` mounted as volume.
