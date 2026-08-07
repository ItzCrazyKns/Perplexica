# 02 — OAuth Connect Flow

**What to build:** The user connects their Notion workspace from Settings through a real OAuth 2.0 flow: "Connect Notion" opens Notion's authorization page (with the user's chosen page picker), the callback exchanges the code for a token, the connection is stored (via ticket 01), the workspace name is shown in Settings, and "Disconnect" revokes it. Authorization requests read, insert, and update content capabilities — nothing else.

**Blocked by:** 01 — Notion Connection Infrastructure

**Status:** ready-for-agent

- [ ] Settings shows "Connect Notion" when no connection exists and the workspace name + "Disconnect" when one does.
- [ ] Connect builds the Notion authorize URL (client id, redirect uri, state) and opens it; the state is validated on return (CSRF).
- [ ] The callback exchanges the authorization code server-side (Basic auth, Notion-Version header) and stores the token via the ticket 01 module.
- [ ] Disconnect removes the connection and any per-chat page state referencing it.
- [ ] No token, client secret, or code is ever written to logs, client bundles, or env files.
