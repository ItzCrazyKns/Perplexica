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
  - `MetaSearchAgent` router — selects between optimization modes (`speed` vs `agent`) and routes per focus mode. See `src/lib/search/metaSearchAgent.ts` and handlers in `src/lib/search/index.ts`.
  - `SimplifiedAgent` (LangGraph React Agent) — single, unified agent that uses tools to perform web search, local file search, URL summarization, and more. See `src/lib/search/simplifiedAgent.ts` with state in `src/lib/state/chatAgentState.ts` and prompts in `src/lib/prompts/simplifiedAgent/*`.
  - `SpeedSearch` — fast, non-agent pipeline used when optimization mode is `speed`. See `src/lib/search/speedSearch.ts`.
    - Tools used by the agent live in `src/lib/tools/agents` (e.g., `web_search`, `file_search`, `url_summarization`, `image_search`).
  - `DeepResearchAgent` — advanced agent for deep research workflows with planning, iterative retrieval, extraction, and synthesis. See `src/lib/search/deepResearchAgent.ts`.

#### Tool Call Lifecycle Events (UI Integration)

The `SimplifiedAgent` now emits granular lifecycle events for each tool execution so the UI can reflect real-time status (spinner → success ✔ / error ✕):

| Event Type          | When Emitted                                                     | Payload                                                                                                                      | UI Behavior                                                                                                    |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `tool_call_started` | Immediately when a tool run begins (LangChain `handleToolStart`) | `{ data: { content: "<ToolCall … status=\"running\" toolCallId=\"RUN_ID\" …></ToolCall>", toolCallId, status: "running" } }` | Appends a ToolCall widget with spinner                                                                         |
| `tool_call_success` | On successful completion (`handleToolEnd`)                       | `{ data: { toolCallId, status: "success", extra?: { [k: string]: string } } }`                                               | Replaces the widget status icon with green check; merges any `extra` attributes into existing `<ToolCall>` tag |
| `tool_call_error`   | On exception (`handleToolError`)                                 | `{ data: { toolCallId, status: "error", error: "message" } }`                                                                | Replaces spinner with red X and shows error text                                                               |

#### Deep Research Events

The `DeepResearchAgent` emits additional event types to support its workflow:

| Event Type | When Emitted               | Payload                                                                              | UI Behavior                             |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------- |
| `progress` | Throughout research phases | `{ data: { message: string, current: number, total: number, subMessage?: string } }` | Update progress bar and status messages |

**Note on Clarification**: When the initial query is too vague or ambiguous (first pass only), the agent outputs clarification questions as a standard response message rather than a separate event type. The research ends early with status `needs_clarification`, and the user can provide more context in their next message.

Implementation details:

- Backend emission logic lives in `simplifiedAgent.ts` where callbacks (`handleToolStart`, `handleToolEnd`, `handleToolError`) serialize events to the streaming emitter (`type` field above).
- The API layer (`/src/app/api/chat/route.ts`) transparently forwards these new event types to the client with the active assistant `messageId`.
- The frontend (`ChatWindow.tsx`) handles:
  - `tool_call_started`: appends the received `<ToolCall …>` markup to the in-progress assistant message.
  - `tool_call_success` / `tool_call_error`: regex-rewrites the existing `<ToolCall … toolCallId="RUN_ID" …>` tag, updating `status`, adding `error` (if present) and merging any key/value pairs under `extra` (e.g. `{ videoId }`) as attributes.
- The markdown renderer's `ToolCall` component (`MarkdownRenderer.tsx`) now accepts `status` + `error` attributes and renders the appropriate indicator:
  - `running`: inline spinner
  - `success`: green check
  - `error`: red X + error message (truncated, sanitized)

Notes / Constraints:

- Tool attributes (`query`, `count`, `url`) are lightly extracted on start and truncated to avoid large payloads.
- `toolCallId` is the LangChain run ID ensuring uniqueness across concurrent tool executions.
- For persistence, the start markup is appended to the stored assistant message content; on `tool_call_success` / `tool_call_error` the backend rewrites the original `<ToolCall …>` tag in the accumulated message with the final `status` (and `error` attribute if present).
- A shared helper (`updateToolCallMarkup` in `src/lib/utils/toolCallMarkup.ts`) is used by both backend and frontend to guarantee identical attribute mutation logic.
- A synthetic Firefox AI detection event is represented as a single `tool_call_started` with `status="success"` and `type="firefoxAI"` (no actual external tool execution).

### External Services

- **Search Engine**: SearXNG integration (`src/lib/searxng.ts`)
- **Configuration**: TOML-based config file

### Data Flow

1. User query → API route (`src/app/api/chat/route.ts` or `src/app/api/search/route.ts`) with focus mode, optimization mode, chatModel, systemModel, query, etc.
2. `MetaSearchAgent` decides optimization path:

- `speed`: use `SpeedSearch` pipeline to retrieve, optionally rerank, and summarize (System Model for search/summarization; Chat Model for final answer)
- `agent`: run `SimplifiedAgent` (LangGraph React Agent) with appropriate tools based on focus mode (System Model inside tools; Chat Model for the agent and streamed answer)
  - Tools perform actions (e.g., SearXNG web search, local file search, URL/content extraction) using the System Model and accumulate `relevantDocuments` in agent state
  - Agent streams the response tokens and tool-call hints; citations come from collected `relevantDocuments`
  - Special case: Firefox AI prompt detection disables tools for that turn and answers conversationally
- `deepResearch`: run `DeepResearchAgent` for deep research workflows (System Model for planning, retrieval, extraction; Chat Model for agent decisions and final answer)
  - The agent plans subquestions, gathers results via SearXNG, extracts facts/quotes, ranks evidence, and synthesizes a final answer with citations
  - Intelligent looping and sufficiency checks ensure comprehensive coverage
  - **Clarification Request**: On the first pass (planPass === 0) with minimal chat history (≤2 messages), evaluates if the query needs clarification using `clarificationEvaluatorTool`
    - If the query is vague, ambiguous, or missing critical context, the agent emits a `clarification_needed` event with 2-4 specific questions
    - The agent then returns early with status `needs_clarification`, allowing the user to provide more details before continuing
    - On subsequent user messages with additional context, the agent proceeds with the full research workflow

## Project Structure

- `/src/app`: Next.js app directory with page components and API routes
  - `/src/app/api`: API endpoints for search and LLM interactions
- `/src/components`: Reusable UI components
- `/src/lib`: Backend functionality
  - `lib/search`: `SimplifiedAgent`, `MetaSearchAgent` router, `SpeedSearch`, `DeepResearchAgent`, focus-mode handlers
  - `lib/db`: Database schema and operations
  - `lib/providers`: LLM and embedding model integrations
  - `lib/prompts`: Prompt templates for LLMs (including `prompts/simplifiedAgent/*`)
  - `lib/chains`: Additional specialized chains (e.g., image/video search helpers)
  - `lib/state`: LangGraph agent state annotations (e.g., `chatAgentState.ts`)
  - `lib/utils`: Utility functions and types including web content retrieval and processing
  - `lib/tools/agents`: Agent tools for specialized tasks
    - `web_search`: Web search via SearXNG
    - `file_search`: Local file semantic search
    - `url_summarization`: Extract and summarize web content
    - `image_search`: Image search functionality
    - `deepPlannerTool`: Generates research subquestions and criteria for deep research
    - `clarificationEvaluatorTool`: Evaluates if a query needs clarification before deep research

## Focus Modes

Perplexica supports multiple specialized search modes:

- Web Search Mode: General web search
- Local Research Mode: Research and interact with local files with citations
- Chat Mode: Have a creative conversation
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
- **Do not run a build to check for errors unless requested**
- Prioritize existing patterns and architectural decisions
- Use the established component structure and styling patterns
- Always update documentation and comments to reflect code changes
- Always update `AGENTS.md` to reflect relevant changes to AI guidelines. This file should **only** reflect the **current** state of the project and should not be used as a historical log.

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
