# GitHub Copilot Instructions for Perplexica

This file provides context and guidance for GitHub Copilot when working with the Perplexica codebase.

## Project Overview

Perplexica is an open-source AI-powered search engine that uses advanced machine learning to provide intelligent search results. It combines web search capabilities with LLM-based processing to understand and answer user questions, similar to Perplexity AI but fully open source.

## Key Components

- **Frontend**: Next.js application with React components (in `/src/components` and `/src/app`)
- **Backend Logic**: Node.js backend with API routes (in `/src/app/api`) and library code (in `/src/lib`)
- **Search Engine**: Uses SearXNG as a metadata search engine
- **LLM Integration**: Supports multiple models including OpenAI, Anthropic, Groq, Ollama (local models)
- **Database**: SQLite database managed with Drizzle ORM

## Architecture

The system works through these main steps:

- User submits a query
- The system determines if web search is needed
- If needed, it searches the web using SearXNG
- Results are ranked using embedding-based similarity search
- LLMs are used to generate a comprehensive response with cited sources

## Key Technologies

- **Frontend**: React, Next.js, Tailwind CSS
- **Backend**: Node.js
- **Database**: SQLite with Drizzle ORM
- **AI/ML**: LangChain for orchestration, various LLM providers
- **Search**: SearXNG integration
- **Embedding Models**: For re-ranking search results

## Project Structure

- `/src/app`: Next.js app directory with page components and API routes
- `/src/components`: Reusable UI components
- `/src/lib`: Backend functionality
  - `/lib/search`: Search functionality and meta search agent
  - `/lib/db`: Database schema and operations
  - `/lib/providers`: LLM and embedding model integrations
  - `/lib/prompts`: Prompt templates for LLMs
  - `/lib/chains`: LangChain chains for various operations

## Focus Modes

Perplexica supports multiple specialized search modes:

- All Mode: General web search
- Local Research Mode: Research and interact with local files with citations
- Chat Mode: Have a creative conversation
- Academic Search Mode: For academic research
- YouTube Search Mode: For video content
- Wolfram Alpha Search Mode: For calculations and data analysis
- Reddit Search Mode: For community discussions

## Development Workflow

- Use `npm run dev` for local development
- Format code with `npm run format:write` before committing
- Database migrations: `npm run db:push`
- Build for production: `npm run build`
- Start production server: `npm run start`

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

## AI Behavior

- Avoid conciliatory language
- It is not necessary to apologize
- If you don't know the answer, ask for clarification
- Do not add additional packages or dependencies unless explicitly requested
- Only make changes to the code that are relevant to the task at hand
