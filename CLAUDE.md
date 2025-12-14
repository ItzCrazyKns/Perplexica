# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Perplexica is a privacy-focused AI answering engine that combines web search (via SearxNG) with LLMs to provide cited answers. It supports both local LLMs (via Ollama) and cloud providers (OpenAI, Anthropic Claude, Google Gemini, Groq).

## Common Development Commands

### Setup and Development
```bash
npm install                # Install dependencies
npm run db:migrate         # Set up SQLite database (required for first-time setup)
npm run dev                # Start development server on localhost:3000
```

### Build and Production
```bash
npm run build             # Build for production
npm start                 # Start production server
```

### Code Quality
```bash
npm run lint              # Run ESLint
npm run format:write      # Format code with Prettier (ALWAYS run before committing)
```

### Database
The database is SQLite managed by Drizzle ORM. Schema is in `src/lib/db/schema.ts`. Database file is located at `data/db.sqlite`.

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 18, TypeScript, TailwindCSS
- **Backend**: Next.js API Routes, LangChain for LLM orchestration
- **Database**: SQLite with Drizzle ORM
- **Search Engine**: SearxNG (self-hosted metadata search engine)
- **AI Providers**: Support for Ollama, OpenAI, Anthropic, Google Gemini, Groq

### Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   │   ├── chat/         # Main chat interface
│   │   ├── search/       # Direct search API
│   │   ├── providers/    # LLM provider management
│   │   ├── images/       # Image search
│   │   ├── videos/       # Video search
│   │   └── suggestions/  # Query suggestions
│   ├── c/                # Chat pages
│   ├── discover/         # Discover feature
│   ├── library/          # Search history
│   └── settings/         # Configuration
├── components/           # React components
└── lib/                  # Backend logic
    ├── chains/           # LangChain chain definitions
    ├── prompts/          # LLM prompt templates
    ├── search/           # Search logic and focus modes
    ├── db/               # Database schema and operations
    ├── providers/        # LLM and embedding model providers
    ├── models/           # Data models
    ├── utils/            # Utility functions
    └── config/           # Configuration management
```

### Core Concepts

#### Focus Modes
All focus modes are implemented using the `MetaSearchAgent` class in `src/lib/search/metaSearchAgent.ts`. Each mode is configured with:
- `activeEngines`: Which search engines to use (e.g., 'arxiv', 'youtube', 'reddit', 'wolframalpha')
- `queryGeneratorPrompt`: How to generate search queries
- `responsePrompt`: How to format responses
- `rerank`: Whether to re-rank results using embeddings
- `searchWeb`: Whether to search the web

Available focus modes (defined in `src/lib/search/index.ts`):
- `webSearch` - General web search
- `academicSearch` - Academic papers (arXiv, Google Scholar, PubMed)
- `writingAssistant` - No web search, direct LLM response
- `wolframAlphaSearch` - Computational queries
- `youtubeSearch` - YouTube videos
- `redditSearch` - Reddit discussions

#### Search Flow
1. User sends query to `/api/chat` endpoint
2. Chain determines if web search is needed and generates optimized query
3. If search needed: Query sent to SearxNG → Results retrieved
4. Results are embedded and re-ranked using cosine similarity against query embeddings
5. Top sources passed to response generator chain
6. LLM generates cited response, streamed to UI

#### LangChain Integration
- **Chains** (`src/lib/chains/`): Define multi-step LLM workflows
  - `imageSearchAgent.ts` - Image search logic
  - `videoSearchAgent.ts` - Video search logic
  - `suggestionGeneratorAgent.ts` - Query suggestions
- **Prompts** (`src/lib/prompts/`): Prompt templates for different tasks
  - `webSearch.ts` - Web search prompts
  - `writingAssistant.ts` - Writing assistant prompts

#### Provider System
Located in `src/lib/providers/`, manages:
- Chat model providers (OpenAI, Anthropic, Ollama, etc.)
- Embedding model providers for semantic search
- Provider configuration and API key management

## Key Implementation Details

### Adding a New Focus Mode
1. Create a new `MetaSearchAgent` instance in `src/lib/search/index.ts`
2. Configure with appropriate engines, prompts, and reranking settings
3. Add corresponding UI option in focus mode selector component

### Database Migrations
When modifying `src/lib/db/schema.ts`:
1. Update the schema
2. Run `npm run db:migrate` to generate migration files
3. Migrations are stored in `drizzle/` directory

### Embedding-Based Re-ranking
The system uses embedding models to improve search result relevance:
1. Documents and query are converted to embeddings
2. Cosine similarity computed between query and each result
3. Results above `rerankThreshold` are kept and sorted by similarity
4. This happens in the MetaSearchAgent before passing to response chain

### Configuration
- Runtime config managed through UI at `/settings`
- Config stored in database (not environment variables for most settings)
- For development setup, see CONTRIBUTING.md for config.toml setup

## Docker Setup

Perplexica can run with bundled SearxNG or connect to external SearxNG:
- `Dockerfile` - Full image with bundled SearxNG
- `Dockerfile.slim` - Slim image without SearxNG (requires external instance)
- `docker-compose.yaml` - Multi-container setup

## Important Notes

- Always run `npm run format:write` before committing (enforces code style)
- Database migrations are required when schema changes
- The MetaSearchAgent class is central to all search functionality
- LLM citations are achieved through prompt engineering, not post-processing
- Search results are re-ranked using embeddings for better relevance
