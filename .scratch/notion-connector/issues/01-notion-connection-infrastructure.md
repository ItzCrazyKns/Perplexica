# 01 — Notion Connection Infrastructure

**What to build:** The foundation the whole connector stands on: a persisted, encrypted Notion Connection. The connection record (workspace id/name, encrypted access token) is created, loaded, updated, and deleted; the token encrypts with a key from `NOTION_TOKEN_KEY` and decrypts back without ever appearing in logs.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A `notion_connections` table exists (drizzle migration applied on startup) and holds one row: workspace id, workspace name, encrypted access token, timestamps.
- [ ] A token module encrypts the token with the `NOTION_TOKEN_KEY` env key before storage and decrypts it back losslessly (round-trip test green).
- [ ] The connector can read, upsert, and delete the connection; missing key or missing connection produce clear, non-crashing errors.
- [ ] No log statement can print the token.
