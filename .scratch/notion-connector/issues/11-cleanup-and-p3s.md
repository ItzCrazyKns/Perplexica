# 11 — Cleanup & P3s

**What to build:** Small hygiene items that don't change behavior — ADR wording, schema consistency, a mention-boundary edge, and a misleading test name. From cubic-dev-ai[bot] review comments folded into PR2 (`docs/review-fixes.md` → P3 `#3`, `#38`, `#39`, `#45`).

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `docs/adr/0001` — describe the `'notion'` source in present-tense-consistent wording (it's an implemented extension now, not only a planned one) (`#3`).
- [ ] `db/schema.ts` — `notionPages` column marked `notNull` to match the migration (`#38`).
- [ ] `mention.ts` — `NAME_BOUNDARY` no longer truncates version-like hints (e.g. `@Notion v1.0 規劃` should keep `v1.0`); adjust the boundary set or require whitespace before punctuation (`#39`).
- [ ] `actions/notion/actions.test.ts` — rename `mockFetchOnce` → `mockFetch` (it is `mockResolvedValue` for every call) (`#45`).
