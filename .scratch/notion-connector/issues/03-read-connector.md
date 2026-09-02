# 03 — Read Connector

**What to build:** The connector can read from the Notion Connection: list and search Authorized Pages, get a page's content, and query a shared database. Page names resolve via Fuzzy Page Search (leading-words partial match). All HTTP goes through one client that always sends the token and Notion-Version header.

**Blocked by:** 01 — Notion Connection Infrastructure

**Status:** ready-for-agent

- [ ] A single HTTP client performs all Notion requests with the stored token and `Notion-Version` header; unit tests mock the HTTP boundary.
- [ ] Listing/searching authorized pages returns id + title (+ type); the response feeds the picker.
- [ ] Fuzzy Page Search matches a typed name by its leading words and returns ranked candidates (tests cover partial and non-matching names).
- [ ] Getting a page returns its content (prefer the markdown endpoint; fall back to block children), truncated/paginated safely for LLM context.
- [ ] Querying a database returns its entries as readable text.
