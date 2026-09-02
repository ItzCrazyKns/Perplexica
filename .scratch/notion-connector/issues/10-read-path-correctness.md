# 10 — Read-Path Correctness

**What to build:** Close the remaining read-side correctness gaps: make the researcher testable without a real DB, handle data_source titles, and reconstruct truncated-page content in reading order. From cubic-dev-ai[bot] review comments folded into PR2 (`docs/review-fixes.md` → P2 `#44`, `#46`, `#47`, `#48`).

**Blocked by:** 03 — Read Connector（PR1 已完成）

**Status:** ready-for-agent

- [ ] `researcher/index.ts` — the researcher no longer imports the db singleton directly; the db flows through `ResearcherInput`/`SearchAgentConfig` like the tools already do, and a unit test constructs it without a real DB file (`#44`).
- [ ] `search.ts` — `data_source` objects read `title` with a `name` fallback so API responses that only carry a title don't render as Untitled (`#46`).
- [ ] `pages.ts` — subtree recovery re-inserts each unknown block's text at its original position (in the order `unknown_block_ids` appear in the markdown) instead of appending everything at the end (`#47`).
- [ ] `pages.ts` — unsupported blocks fall back to the blocks API even when `truncated=false`; `unknown_block_ids` are processed independently of the truncation flag (`#48`).
