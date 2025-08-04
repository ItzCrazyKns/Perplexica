# Project Overview

Perplexica is an open-source AI-powered search engine that uses advanced machine learning to provide intelligent search results. It combines web search capabilities with LLM-based processing to understand and answer user questions, similar to Perplexity AI but fully open source.

## Architecture

The system works through these main steps:

- User submits a query
- The system determines if web search is needed
- If needed, it searches the web using SearXNG
- Results are ranked using embedding-based similarity search
- LLMs are used to generate a comprehensive response with cited sources

## Architecture Details

### Technology Stack

- **Frontend**: React, Next.js, Tailwind CSS
- **Backend**: Node.js
- **Database**: SQLite with Drizzle ORM
- **AI/ML**: LangChain + LangGraph for orchestration
- **Search**: SearXNG integration
- **Content Processing**: Mozilla Readability, Cheerio, Playwright

### Database (SQLite + Drizzle ORM)

- Schema: `src/lib/db/schema.ts`
- Tables: `messages`, `chats`, `systemPrompts`
- Configuration: `drizzle.config.ts`
- Local file: `data/db.sqlite`

### AI/ML Stack

- **LLM Providers**: OpenAI, Anthropic, Groq, Ollama, Gemini, DeepSeek, LM Studio
- **Embeddings**: Xenova Transformers, similarity search (cosine/dot product)
- **Agents**: `webSearchAgent`, `analyzerAgent`, `synthesizerAgent`, `taskManagerAgent`

### External Services

- **Search Engine**: SearXNG integration (`src/lib/searxng.ts`)
- **Configuration**: TOML-based config file

### Data Flow

1. User query → Task Manager Agent
2. Web Search Agent → SearXNG → Content extraction
3. Analyzer Agent → Content processing + embedding
4. Synthesizer Agent → LLM response generation
5. Response with cited sources

## Project Structure

- `/src/app`: Next.js app directory with page components and API routes
  - `/src/app/api`: API endpoints for search and LLM interactions
- `/src/components`: Reusable UI components
- `/src/lib`: Backend functionality
  - `lib/search`: Search functionality and meta search agent
  - `lib/db`: Database schema and operations
  - `lib/providers`: LLM and embedding model integrations
  - `lib/prompts`: Prompt templates for LLMs
  - `lib/chains`: LangChain chains for various operations
  - `lib/agents`: LangGraph agents for advanced processing
  - `lib/utils`: Utility functions and types including web content retrieval and processing

## Focus Modes

Perplexica supports multiple specialized search modes:

- All Mode: General web search
- Local Research Mode: Research and interact with local files with citations
- Chat Mode: Have a creative conversation
- Academic Search Mode: For academic research
- YouTube Search Mode: For video content
- Wolfram Alpha Search Mode: For calculations and data analysis
- Reddit Search Mode: For community discussions

## Core Commands

- **Development**: `npm run dev` (uses Turbopack for faster builds)
- **Build**: `npm run build` (includes automatic DB push)
- **Production**: `npm run start`
- **Linting**: `npm run lint` (Next.js ESLint)
- **Formatting**: `npm run format:write` (Prettier)
- **Database**: `npm run db:push` (Drizzle migrations)

## Configuration

The application uses a `config.toml` file (created from `sample.config.toml`) for configuration, including:

- API keys for various LLM providers
- Database settings
- Search engine configuration
- Similarity measure settings

## Common Tasks

When working on this codebase, you might need to:

- Add new API endpoints in `/src/app/api`
- Modify UI components in `/src/components`
- Extend search functionality in `/src/lib/search`
- Add new LLM providers in `/src/lib/providers`
- Update database schema in `/src/lib/db/schema.ts`
- Create new prompt templates in `/src/lib/prompts`
- Build new chains in `/src/lib/chains`
- Implement new LangGraph agents in `/src/lib/agents`

## AI Behavior Guidelines

- Focus on factual, technical responses without unnecessary pleasantries
- Avoid conciliatory language and apologies
- Ask for clarification when requirements are unclear
- Do not add dependencies unless explicitly requested
- Only make changes relevant to the specific task
- **Do not create test files or run the application unless requested**
- Prioritize existing patterns and architectural decisions
- Use the established component structure and styling patterns

## Code Style & Standards

### TypeScript Configuration

- Strict mode enabled
- ES2017 target
- Path aliases: `@/*` → `src/*`
- No test files (testing not implemented)

### Formatting & Linting

- ESLint: Next.js core web vitals rules
- Prettier: Use `npm run format:write` before commits
- Import style: Use `@/` prefix for internal imports

### File Organization

- Components: React functional components with TypeScript
- API routes: Next.js App Router (`src/app/api/`)
- Utilities: Grouped by domain (`src/lib/`)
- Naming: camelCase for functions/variables, PascalCase for components

### Error Handling

- Use try/catch blocks for async operations
- Return structured error responses from API routes

## Available Tools and Help

- You can use the context7 tool to get help using the following identifiers for libraries used in this project
  - `/langchain-ai/langchainjs` for LangChain
  - `/langchain-ai/langgraph` for LangGraph
  - `/quantizor/markdown-to-jsx` for Markdown to JSX conversion
  - `/context7/headlessui_com` for Headless UI components
