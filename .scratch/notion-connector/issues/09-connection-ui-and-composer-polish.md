# 09 — Connection UI & Composer Polish

**What to build:** Fix the remaining connection/UI and @Notion composer rough edges so the read flow feels finished: no infinite spinners, no lost deep links, no stuck composer on bare mentions, and unambiguous-only mention binding. From cubic-dev-ai[bot] review comments folded into PR2 (`docs/review-fixes.md` → P2 `#14`, `#19`, `#20`, `#23`, `#27`, `#28`, `#33`).

**Blocked by:** 02 — OAuth Connect Flow, 04 — @Notion In-Conversation Selection（PR1 已完成）

**Status:** ready-for-agent

- [ ] `Settings/Sections/Notion.tsx` — `/api/notion/status` failure shows an error state with a Retry button, never an infinite spinner (`#14`).
- [ ] `ChatWindow.tsx` — clearing the connection params removes only the `notion` query param; `?q=` deep-link state survives (`#19`).
- [ ] OAuth connect opens in a new tab + poll, or the Settings dialog is restored after the redirect — the user never lands on the home page mid-session (`#20`).
- [ ] `/api/notion/status` — restrict by origin or return only a boolean `connected`; workspaceId/Name no longer readable by unauthenticated callers (`#23`).
- [ ] `useChat.tsx` — client refuses to send a bare-`@Notion` message (empty `finalContent.trim()`) with a helpful hint instead of a 400 + stuck composer (`#27`).
- [ ] `useChat.tsx` — the @Notion activation state persists independently of selected pages, not only for the current POST (`#28`).
- [ ] `mention.ts` — low-confidence fuzzy hints are NOT auto-bound; only unambiguous/high-confidence matches bind, everything else stays unresolved for agent re-confirmation (`#33`).
