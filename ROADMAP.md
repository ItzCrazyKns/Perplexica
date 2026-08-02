Vane repo review

TLDR: the app works but carries three classes of debt.
Security holes that expose your API keys to anyone on the network.
A streaming and state design that is O(n squared) in answer length on both server and client.
Roughly 2,500 lines of copy-paste and dead code that can be deleted with no behavior change.
There are also zero tests, which makes every other fix riskier than it should be.

Fix first: security (before any refactor)

1. GET /api/config returns every provider API key in plaintext, unauthenticated (src/app/api/config/route.ts:13). There is no middleware.ts and no auth anywhere. Mask password-type fields server side and treat empty submits as unchanged.
2. POST /api/config allows prototype pollution and arbitrary config writes via dotted keys like __proto__.x (src/lib/config/index.ts:254-272). Allowlist keys from uiConfigSections.
3. SSRF everywhere: provider create/update lets a caller point baseURL at internal hosts and exfiltrate stored keys (src/app/api/providers/route.ts:35), and scrape_url will drive a root, no-sandbox Chromium to any URL a user or a scraped page suggests (src/lib/scraper.ts:20-26, Dockerfile:64). Block private/loopback/metadata ranges after DNS resolution, and run the container as non-root.
4. No rate limits, no origin checks, no upload size caps: /api/uploads buffers unlimited files in RAM and burns embedding quota (src/lib/uploads/manager.ts:181).

A single middleware.ts with a shared secret plus an origin check would close most of this for a self-hosted app.

Fix second: correctness bugs that break search today

- The researcher drops sibling tool calls when done arrives in the same batch, which the prompt itself instructs (src/lib/agents/search/researcher/index.ts:154-156). This silently returns empty context to the writer.
- Tool results are zipped by completion order, not call order, so results get attributed to the wrong tool call (actions/registry.ts:90-103). Use Promise.all return order.
- searchAsync is fire-and-forget with no catch (src/app/api/chat/route.ts:213). Any provider error is an unhandled rejection: the stream hangs forever and the message row stays answering. Nothing ever emits the error event the client already handles.
- Rewrite reuses the old messageId, so messageEnd is deduped and the UI stays in loading forever (src/lib/hooks/useChat.tsx:632).
- splitText infinite-loops on any segment over maxTokens, reachable with CJK text or PDF tables (src/lib/utils/splitText.ts:36-43).
- The NDJSON client parser re-dispatches already-parsed lines on partial chunks (useChat.tsx:788-805).
- Hand-rolled migrations run without transactions; a crash mid-migration bricks the DB, and failures are swallowed at boot (src/lib/db/migrate.ts, src/instrumentation.ts:5-9).

Delete (no behavior change, roughly 2,500 lines plus 5 deps)

- Unused deps: @google/genai, @icons-pack/react-simple-icons, @radix-ui/react-tooltip, axios, mammoth. Also add tsconfig.tsbuildinfo to .gitignore.
- Provider layer: 8 alias files that only re-export the OpenAI classes, plus dead methods streamObject, generateText, embedChunks implemented by every provider and called by nothing (about 250 lines).
- src/lib/agents/search/api.ts: a drifted copy of the main SearchAgent that also leaks a session per request. Fold into one agent with a persist flag.
- Dead files: src/lib/utils/jaccardSim.ts, src/lib/serverActions.ts, src/lib/utils/files.ts, src/components/theme/Switcher.tsx.
- Dead logic: skipSearch guards that can never be false, the personalSearch classifier field that is computed by an LLM and never used, images.remotePatterns in next.config, the stray 1; in Rewrite.tsx:19.
- Frontend duplicates: AttachSmall, SettingsButtonMobile, three identical Settings section files, two inlined copies of the Loader SVG.

Simplify (biggest structural wins)

- Collapse the provider layer. 69 percent of the non-OpenAI provider code is byte-duplicated from the OpenAI provider. One OpenAICompatibleProvider parameterized by {name, baseURL, listModels, capabilities} turns groq/lmstudio/lemonade/gemini/anthropic into 20-line config objects. About 700 lines removed.
- Collapse the three search actions (webSearch, academicSearch, socialSearch) into one createSearchAction({name, engines, enabled}) factory. They differ only in config and have already drifted.
- Deduplicate the extractor prompt, copied byte-for-byte in two files, one copy with 18 spaces of indentation that inflates token cost on every extraction call (baseSearch.ts:328, scrapeURL.ts:7).
- Decompose useChat.tsx (847 lines, 8 concerns): pure transport module, a useReducer for stream events, and split state/actions/settings contexts so the input bar stops re-rendering on every token.
- Replace the hand-rolled migrate.ts with drizzle's migrator plus one transactional backfill script.
- Standardize on one animation lib: framer-motion is used in 12 files but is not even in package.json; only motion is declared. This breaks on a strict install.

Performance (ranked by user-visible impact)

Server:
1. Streaming protocol is O(n squared): every token re-sends the full accumulated answer as a replace patch, and SessionManager retains every one of those snapshots for 30 minutes (agents/search/index.ts:162, session.ts:47). A 2,000-word answer pushes about 18 MB. Switch to append deltas and replay only the current block snapshot on reconnect. This is the single biggest fix in the repo.
2. Every chat request makes 1 or 2 live /models HTTP calls to providers before the first token, and new ModelRegistry() per request re-validates everything (registry.ts:74, 13 call sites). Cache model lists with a short TTL and use a singleton registry.
3. The transformers.js embedding pipeline reloads ONNX weights on every request (transformerEmbedding.ts:10). Hoist to a module-level map.
4. Quality mode has unbounded fan-out: up to 25 iterations times about 30 LLM/scrape calls with no semaphore, no deadline, no token budget. Add a ResearchBudget and a concurrency limit (async-mutex is already a dep).
5. SQLite: no index on messages.chatId, no WAL, sync full-table scans on the event loop; /api/chats loads every row unbounded. Add indexes, WAL pragma, orderBy plus limit.
6. Embeddings stored as pretty-printed JSON (about 5x size) and re-parsed synchronously per query; the researcher re-reads whole embedding files every iteration just for 3 text snippets (uploads/manager.ts:112, prompts/search/researcher.ts:329). Store binary, cache parsed vectors, hoist out of the loop.

Client:
1. No React.memo anywhere; every message re-parses its full markdown per streamed token, and the sections memo recomputes all messages per token (useChat.tsx:316, MessageBox.tsx:180). Memoize per message.
2. Bundle: full react-syntax-highlighter (all 190 languages), jsarts, and Node crypto polyfill all ship eagerly; zeronext/dynamic usage in the repo. Lazy-load all four.
3. /discover and /library are client pages with fetch waterfallsorce-dynamic; both are fully server-renderable. Convert to RSCand scope force-dynamic to chat routes.
4. Weather widget polls every 30 seconds including reverse geoco-second interval forever.

Architecture changes

- Introduce a ContextStore in the researcher. Chunk identity, deted rendering are currently reimplemented in three places with
three different keys, and substep objects are mutated after beinonnect replays.
- Make streaming a typed event protocol (appendText, addSubStep)hat are really full snapshots (session.ts:62). This fixes the O(n squared) wire format, the session memory blowup, and the client reducer complexity in one move.
- Replace the provider class hierarchy (abstract statics that thProviderDefinition object contract; delete the serverRegistrypass-through layer.
- Trusted-data boundary for scraped content: titles and page texriter and tool prompts, so any web page can inject instructionsor steer scrape_url to internal URLs. Escape delimiters and allowlist scrape targets to URLs SearXNG surfaced.
- Add auth middleware, and add at least a smoke-test suite (the ndertaking the refactors above.

Suggested order

1. Security batch: key masking, config key allowlist, SSRF guard
2. Correctness batch: done-tool handling, result ordering, catch, splitText loop, transactional migrations.
3. Quick wins: delete dead code and deps, model-list cache, registry singleton, transformers cache, SQLite pragmas and indexes, lazy-load heavy client libs.
4. The streaming protocol rewrite (server events plus useChat reducer together).
5. Provider layer collapse and search action factory.
6. RSC conversion for discover/library and useChat decomposition

I can start on any of these; the security batch plus quick wins anges and would be my pick for a first PR.
