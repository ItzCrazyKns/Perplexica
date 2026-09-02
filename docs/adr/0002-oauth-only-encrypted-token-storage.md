# Notion uses OAuth 2.0 only; tokens stored encrypted at rest

Notion authorization is OAuth 2.0 only — no integration token is ever hardcoded in `.env` or code. The access token is stored encrypted in a dedicated `notion_connections` table (SQLite/drizzle), encrypted with a key supplied via the `NOTION_TOKEN_KEY` env var, and the connection requests only read, insert, and update content capabilities. Keeps the token a server-side secret and makes the feature presentable to the upstream project.
