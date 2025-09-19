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
- **Model Roles**:
  - Chat Model: used for final response generation and agent decision-making (createReactAgent, deep synthesis)
  - System Model: used for internal, non-user-facing tasks (query generation, URL summarization, planning, lightweight extraction)
- **Embeddings**: Xenova Transformers, similarity search (cosine/dot product)
- **Orchestration & Agents**:
  - `SimplifiedAgent` (LangGraph React Agent) — single, unified agent that uses tools to perform web search, local file search, URL summarization, and more. See `src/lib/search/simplifiedAgent.ts` with state in `src/lib/state/chatAgentState.ts` and prompts in `src/lib/prompts/simplifiedAgent/*`.
  - `MetaSearchAgent` router — selects between optimization modes (`speed` vs `agent`) and routes per focus mode. See `src/lib/search/metaSearchAgent.ts` and handlers in `src/lib/search/index.ts`.
  - `SpeedSearch` — fast, non-agent pipeline used when optimization mode is `speed`. See `src/lib/search/speedSearch.ts`.
  - Tools used by the agent live in `src/lib/tools/agents` (e.g., `web_search`, `file_search`, `url_summarization`, `image_search`).

### External Services

- **Search Engine**: SearXNG integration (`src/lib/searxng.ts`)
- **Configuration**: TOML-based config file

### Data Flow

1. User query → API route (`src/app/api/search/route.ts`) with focus mode and optimization mode
2. `MetaSearchAgent` decides optimization path:

- `speed`: use `SpeedSearch` pipeline to retrieve, optionally rerank, and summarize (System Model for search/summarization; Chat Model for final answer)
- `agent`: run `SimplifiedAgent` (LangGraph React Agent) with appropriate tools based on focus mode (System Model inside tools; Chat Model for the agent and streamed answer)

3. Tools perform actions (e.g., SearXNG web search, local file search, URL/content extraction) using the System Model and accumulate `relevantDocuments` in agent state
4. Agent streams the response tokens and tool-call hints; citations come from collected `relevantDocuments`
5. Special case: Firefox AI prompt detection disables tools for that turn and answers conversationally

## Project Structure

- `/src/app`: Next.js app directory with page components and API routes
  - `/src/app/api`: API endpoints for search and LLM interactions
- `/src/components`: Reusable UI components
- `/src/lib`: Backend functionality
  - `lib/search`: `SimplifiedAgent`, `MetaSearchAgent` router, `SpeedSearch`, focus-mode handlers
  - `lib/db`: Database schema and operations
  - `lib/providers`: LLM and embedding model integrations
  - `lib/prompts`: Prompt templates for LLMs (including `prompts/simplifiedAgent/*`)
  - `lib/chains`: Additional specialized chains (e.g., image/video search helpers)
  - `lib/state`: LangGraph agent state annotations (e.g., `chatAgentState.ts`)
  - `lib/utils`: Utility functions and types including web content retrieval and processing

## Focus Modes

Perplexica supports multiple specialized search modes:

- Web Search Mode: General web search
- Local Research Mode: Research and interact with local files with citations
- Chat Mode: Have a creative conversation
- Academic Search Mode: For academic research
- YouTube Search Mode: For video content
- Wolfram Alpha Search Mode: For calculations and data analysis
- Reddit Search Mode: For community discussions
- Firefox AI Mode: Auto-detected; tools are disabled and a conversational response is generated for that turn

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

Additionally, the Settings page exposes:

- Chat Model selector (existing)
- System Model selector (new): persists to localStorage as `systemModelProvider` and `systemModel`. It is not sent to `/api/config`; it’s purely a client preference.
- Link System to Chat toggle: persisted as `linkSystemToChat` (default ON). When enabled, the System model mirrors the Chat model and the System selectors are disabled. Behavior matches the in-chat `ModelConfigurator`.

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

Model usage routing principles:

- Use Chat Model for: final answer generation, agent-level reasoning/decisions, and any streamed user-facing output.
- Use System Model for: tools and internal chains (URL summarization, simple web search query/summarization steps, task breakdown, file extraction helpers).

Implementation notes (key files):

- `/src/app/settings/page.tsx`: adds System Model selection UI; values stored in localStorage
- `/src/components/ChatWindow.tsx`: sends `systemModel` alongside `chatModel` to `/api/chat`
- `/src/app/api/chat/route.ts` and `/src/app/api/search/route.ts`: accept `systemModel`, construct both LLMs
- `/src/lib/search/metaSearchAgent.ts`: passes both Chat and System LLMs downstream
- `/src/lib/search/simplifiedAgent.ts`: agent uses Chat LLM; exposes `systemLlm` to tools via config
- Tools in `/src/lib/tools/agents/*`: now expect `config.configurable.systemLlm` for any internal LLM calls
- `/src/lib/search/speedSearch.ts`: uses System LLM for search/summarization prep and Chat LLM for final answer

## AI Behavior Guidelines

- Focus on factual, technical responses without unnecessary pleasantries
- Avoid conciliatory language and apologies
- Ask for clarification when requirements are unclear
- Do not add dependencies unless explicitly requested
- Only make changes relevant to the specific task
- **Do not create test files or run the application unless requested**
- Prioritize existing patterns and architectural decisions
- Use the established component structure and styling patterns
- Always update documentation and comments to reflect code changes
- Always update `.github/copilot-instructions.md` to reflect relevant changes

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
  - `/langchain-ai/langgraphjs` for LangGraph
  - `/quantizor/markdown-to-jsx` for Markdown to JSX conversion
  - `/context7/headlessui_com` for Headless UI components
  - `/tailwindlabs/tailwindcss.com` for Tailwind CSS documentation
  - `/vercel/next.js` for Next.js documentation

## Deep Research Agent (per-subquery pipeline)

The deep research workflow treats each planned subquestion as its own gather/extract/rank pipeline rather than pooling all subqueries into a single candidate list.

- Plan warm-up: before generating subquestions, the agent performs a single lightweight SearXNG search on the user's query and feeds titles/snippets from the top results into the planner. This grounds subquestions in current events/terminology while keeping planning fast.

- For each subquestion:
  - Gather: diversified SearXNG queries via `expandedSearchTool` with semantic reranking to the subquestion intent.
  - Extract: use `readerExtractorTool` with the subquestion as the guidance query; reuse cached extractions when available.
  - Rank: convert extracted facts/quotes into `EvidenceItem[]` via `evidenceStoreTool`, then semantic-rerank to the subquestion.
  - Assess: apply a sufficiency heuristic; if weak, run a focused depth pass (gov/edu, pdfs, methodology/data queries) and re-evaluate.
- Results are aggregated across subquestions for clustering and synthesis. Early synthesis may trigger once coverage is adequate.
- Implementation: `src/lib/search/deepResearchAgent.ts`.

### Intelligent Looping and Sufficiency Checks

- After each Search pass, subqueries with zero extracted sources are removed before assessment.
- Sufficiency check: the System LLM performs a conservative yes/no judgment on whether gathered evidence is enough to answer the user’s question with citations. Inputs include:
  - User question
  - Current plan’s `criteria` and `notes`
  - A compact summary of the chat history
  - A short coverage summary of subqueries and their top sources
- If sufficient: the agent proceeds to Synthesis immediately.
- If not sufficient: the agent loops back to Plan. A re-planning guidance string is injected into the planner input to:
  - Replace or rephrase unproductive subqueries (those removed for zero sources)
  - Target authoritative, up-to-date sources (official docs, methodology/data pages, gov/edu, etc.)
  - Avoid duplicating already covered angles while staying laser-focused on answering the original question
  - Encourage diverse phrasing and domain/site constraints when useful

This loop repeats until the evidence is deemed sufficient or soft/hard budgets force early synthesis. Token usage for the sufficiency judge is attributed to the Analyze phase (system model).

## Token Usage Tracking (Chat vs System)

We track token usage separately for the Chat Model and the System Model across all major pipelines:

- Agents stream periodic `modelStats` snapshots that include both legacy fields (`modelName`, `usage`) and split fields: `modelNameChat`, `modelNameSystem`, `usageChat`, `usageSystem`.
- The `/src/app/api/chat/route.ts` endpoint forwards these snapshots to the client, and on completion persists the full object under `metadata.modelStats` on the message.
- UI components updated:
  - `MessageBoxLoading.tsx` shows live token pills for Chat and System (falls back to legacy total if split is absent).
  - `MessageActions/ModelInfo.tsx` shows per-model names and usage, plus a combined total for backwards compatibility.
- Speed path emits per-model names; deep research and agent paths attribute usage correctly (system = tools/planning/extraction, chat = agent decisions/final answer).

## Web Content Caching

### Web Content Extraction & Caching

Implementation lives in `src/lib/utils/webCache.ts` and is used by the `getWebContent` function in `src/lib/utils/documents.ts`. This cache is transparent to callers of `getWebContent` and returns the same `Document` shape whether served from cache or freshly fetched.

## Respond-Now Short Circuit

Adds a user-triggered short circuit to force an immediate answer with currently gathered context when running Agent or Deep Research optimization modes.

- API: POST `/api/respond-now` with `{ messageId }` to trigger a per-run soft-stop and abort in-flight retrieval.
- Reset: The soft-stop is cleared at the start of a new `/api/chat` request for the same `messageId` and when a request is cancelled.
- Agents: Both `SimplifiedAgent` and `DeepResearchAgent` check `isSoftStop(messageId)` between steps. When set, they skip remaining retrieval and jump to synthesis using whatever context has been collected.
- Tools: Retrieval-aware tools accept `config.configurable.retrievalSignal` (AbortSignal) and should exit early on `AbortError` without failing the run.
- UI: `MessageBoxLoading` renders an “Answer now” button during active runs. It posts to `/api/respond-now` with the current `messageId` and disables itself after click.

Implementation files:

- Run control registry: `src/lib/utils/runControl.ts` (softStop flag + retrieval AbortController per messageId)
- Endpoint: `src/app/api/respond-now/route.ts`
- Resets and registration: `src/app/api/chat/route.ts` (registers retrieval controller, clears softStop at start, cleans up on end/cancel)
- Agents: `src/lib/search/simplifiedAgent.ts`, `src/lib/search/deepResearchAgent.ts`
- Tools: `src/lib/tools/agents/simpleWebSearchTool.ts`, `src/lib/tools/agents/urlSummarizationTool.ts`, `src/lib/tools/agents/imageSearchTool.ts`
- SearXNG client: `src/lib/searxng.ts` now accepts an optional AbortSignal
- Web content: The `getWebContent` function in `src/lib/utils/documents.ts` now accepts an optional AbortSignal
- UI: `src/components/MessageBoxLoading.tsx` (button), plumbed via `src/components/Chat.tsx` and `src/components/ChatWindow.tsx`.

For fact/quote extraction used by the deep research pipeline, prefer `extractFactsAndQuotes` over `summarizeWebContent`:

- Location: `src/lib/utils/extractWebFacts.ts`
- Purpose: structured extraction of short, atomic facts (≤25 words) and concise direct quotes (≤200 chars) scoped to a user query
- Used by: `readerExtractorTool` (`src/lib/tools/agents/readerExtractorTool.ts`)
- Behavior: single-pass extraction with a lightweight relevance check; always processes available content and returns compact arrays suitable for evidence ranking

- Location: OS temp directory under `perplexica-webcache/`
- Capacity: up to 200 entries; purge oldest (LRU) when exceeded
- TTL: 4 hours; expired entries are purged from disk and memory
- Keys: URLs hashed (sha256) for safe filenames
- On-disk format: JSON with `{ url, createdAt, lastAccess, title?, pageContent, html? }`
- In-memory metadata: `{ path, url, createdAt, lastAccess }` only

Implementation lives in `src/lib/utils/webCache.ts` and is used by the `getWebContent` function in `src/lib/utils/documents.ts`. This cache is transparent to callers of `getWebContent` and returns the same `Document` shape whether served from cache or freshly fetched.
