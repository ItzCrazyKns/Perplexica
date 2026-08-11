# Notion Connector — Spec

## Problem Statement

A self-hosted Vane user keeps notes in Notion and wants to ask the AI chat about them and write back to them, exactly like Perplexity's `@Notion` connector. The user needs strict control: Vane must never touch a Notion page unless it was explicitly authorized during OAuth *and* explicitly selected or named inside that specific conversation. There must be no global "Notion is on" mode, no repeated authorization prompts, and no way for the AI to delete or administer anything.

## Solution

From the user's perspective:

- Connect Notion once in Settings via a standard Notion OAuth flow (choose which pages to share). The connection shows the workspace name and can be disconnected at any time.
- In any conversation, either pick an authorized page from a picker or type `@Notion 頁面名`. Vane resolves the name with a fuzzy, leading-words match; if nothing matches, Vane proposes candidates and asks again rather than guessing.
- Ask questions — Vane reads the selected pages and answers from them, citing them like other sources.
- Ask Vane to write: append content, update a page, or create a new page (as a child of a specified page, or at the top level of the workspace, per instruction). Every write and create in one response is grouped into a single confirmation card; approving it executes all of them.
- If Notion is not connected, typing `@Notion` shows one inline hint pointing to Settings — no pop-up, no repeated asking.

## User Stories

1. As a self-hosted Vane user, I want to connect my Notion workspace once through OAuth, so that I control exactly which pages Vane may access.
2. As a user, I want the OAuth flow to let me pick the specific pages/databases to share, so that Vane can never see the rest of my workspace.
3. As a user, I want to see the connected workspace name in Settings and disconnect at any time, so that I can revoke access whenever I want.
4. As a user, I want Vane to store my access token encrypted on the server, so that my Notion credentials are never exposed in config, code, or logs.
5. As a user, I want typing `@Notion` in a conversation to activate Notion for that conversation only, so that other conversations never touch my notes.
6. As a user, I want a page picker in the input that lists the authorized pages, so that I can select a page without guessing names.
7. As a user, I want to be able to type `@Notion 會議筆記` instead of using the picker, so that quick selection is possible.
8. As a user, I want Vane to match my typed page name loosely by its leading words, so that a partial or slightly-off name still resolves.
9. As a user, I want Vane to ask me to confirm the page when nothing matches, so that I never silently read the wrong page.
10. As a user, I want to ask a question about a selected page and get an answer grounded in its content, so that my notes actually inform the chat.
11. As a user, I want database queries against my shared Notion databases, so that structured notes are usable too.
12. As a user, I want Vane to search across my authorized pages, so that I can find content without knowing which page holds it.
13. As a user, I want Vane to append new content to a page I named, so that notes can grow from a conversation.
14. As a user, I want Vane to update a page I named, so that existing notes can be corrected or extended.
15. As a user, I want Vane to create a new page as a child of a page I specified, so that notes land where I want them.
16. As a user, I want Vane to create a brand-new page when I ask, placed as a child of a page I specify or, where the integration supports it, at the top level of the workspace; if top-level creation is unsupported, Vane asks me for an authorized parent page instead.
17. As a user, I want all writes in one response grouped into a single confirmation card, so that I am not prompted per page.
18. As a user, I want the confirmation card to offer create-duplicate / write-into-existing / cancel when a same-named page exists, so that name collisions never surprise me.
19. As a user, I want to be able to reject a confirmation card, so that nothing is written without my approval.
20. As a user, I want a one-time inline hint (with a link to Settings) when I type `@Notion` without a connection, so that I am never nagged by repeated prompts.
21. As a user, I want Vane to never delete, comment on, or administer anything in my workspace, so that my data is only ever read or written as I intend.
22. As a user, I want the UI to call it "Notion", so that naming stays consistent with the other sources.

## Implementation Decisions

- **Authorization is OAuth 2.0 only.** No integration token is ever hardcoded in `.env` or code (no `NOTION_TOKEN=...`). The connection requests only read, insert, and update content capabilities (Connection Capabilities).
- **Encrypted token storage.** The access token is stored encrypted at rest in a dedicated `notion_connections` table (SQLite/drizzle), encrypted with a key from the `NOTION_TOKEN_KEY` env var. Single row: the instance holds exactly one global connection (single-user self-hosted; no user accounts exist in Vane).
- **Per-conversation activation.** The connector manifests as a new `'notion'` value of the existing per-chat sources mechanism. Authorized Pages are listed and resolved only per conversation (In-Conversation Page Selection). Selected pages for a chat are persisted per chat.
- **Fuzzy Page Search.** Page names are matched by the leading words of the typed name; a miss triggers a re-confirmation dialogue with candidate pages, never a silent guess.
- **@Notion handling.** The `@Notion` mention (and page name, when used as syntax) is stripped from the message content before it reaches the model; it acts as structured instruction only. Without a connection, one inline hint is shown; no OAuth pop-up is ever triggered from the chat.
- **Write scope.** Append content to, update, or create pages (New Page Placement: child of a user-specified authorized page, or top level of the workspace, per instruction). Creation-into-workspace must be verified against the integration's allowed parent types during implementation, with a fallback that asks the user for an authorized parent page if unsupported.
- **Write Confirmation.** All write/create operations in one response are batched into a single interactive confirmation card (approve/reject), with a three-way choice on name collisions. This requires an interactive, awaitable block in the otherwise one-way streaming response pipeline.
- **Module boundary.** All Notion API access flows through one connector domain module (client, oauth, token, search, pages, databases). The UI reaches it only through Vane API routes; the agent reaches it only through thin tool adapters. The UI never calls the Notion API directly. No generic Connector interface is introduced until a second connector exists.
- **Tool set (v1).** Six agent tools: notion_search, notion_get_page, notion_query_database, notion_create_page, notion_update_page, notion_append_content. Each maps to the existing research-action shape (schema, tool description, enabled gate, execute).
- **Enabled gates.** Read tools require the `'notion'` source active and a stored connection. Write tools additionally require the write target to be a conversation-selected page and the pending operations to be confirmed.
- **Classifier reuse.** The existing personal-search classification path is the natural hook for triggering Notion tools; reuse it rather than adding a new parallel classifier branch.
- **Read transport.** Prefer Notion's markdown content endpoints for page reads so retrieved text fits LLM context cheaply; use block endpoints where markdown is unavailable.
- **Naming.** UI shows "Notion"; conceptual docs say "Notion Connection"; the code-level source key is `'notion'`.
- **Testing seam.** Unit tests for the connector domain module against a mocked HTTP boundary, using the vitest setup already in the repo (test script in package.json, existing Notion test files).

## Testing Decisions

- A good test asserts external behavior only: given a mocked Notion API response, the connector returns the parsed result; given a typed page name, fuzzy matching resolves the intended page; given a plaintext token and the key, the encrypted round-trip restores it; given an authorization code, the OAuth exchange issues the correct request and stores the token. No test touches implementation internals.
- Module under test: the connector domain module (client, token, fuzzy search, OAuth exchange).
- Prior art: the vitest infrastructure and the existing Notion test files (read.test.ts, oauth.test.ts, token.test.ts, …) established in PR1; these tests extend that same pattern.

## Out of Scope

- Delete capability, comments (read or insert), and user information capabilities.
- Workspace administration of any kind.
- Multiple workspaces or per-user connections (Vane has no user accounts).
- A generic Connector interface or any other connector (Google Drive, GitHub, Slack, Linear).
- Editing existing block content beyond update-page semantics defined by Notion's API; full block-level editing tools.
- Any direct UI-to-Notion calls.

## Further Notes

- Development happens on feature branches in the user's fork; upstream is reached via two PRs (PR1: read — connection, OAuth, read tools, @Notion selection; PR2: write — write tools, confirmation card).
- Glossary: `CONTEXT.md`. Decisions: `docs/adr/0001`–`0004`.
- Implementation order follows the tickets in `.scratch/notion-connector/issues/` (blockers first).
