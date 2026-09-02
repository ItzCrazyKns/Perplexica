# Vane

A self-hosted, single-user AI chat application with search. This glossary currently covers the Notion connector domain.

## Language

**Notion Connection**:
The instance-level OAuth authorization linking Vane to exactly one Notion workspace. Displayed in the UI as "Notion".
_Avoid_: Notion integration (too generic), connector-as-global-toggle

**Authorized Pages**:
The set of pages and databases the workspace owner explicitly shared with the connection during OAuth. The only pages Vane may ever read or write.
_Avoid_: whole-workspace access

**In-Conversation Page Selection**:
The act of a user naming or choosing an authorized page inside a chat, which grants Vane access to that page for that conversation only. A connection alone grants nothing.
_Avoid_: global enablement, always-on Notion

**Fuzzy Page Search**:
Resolving an authorized page from a user's typed page name by partial matching on the leading words of the name.
_Avoid_: exact-match-only lookup

**New Page Placement**:
Where a page created on the user's instruction is placed: as a child of a user-specified authorized page, or at the top level of the workspace.
_Avoid_: fixed default location

**Write Confirmation**:
A single user confirmation covering all write and create operations within one response, approved or rejected as a batch.
_Avoid_: per-operation confirmation prompts

**Connection Capabilities**:
The Notion capabilities granted to the connection: read, insert, and update content. Delete is never granted.
_Avoid_: internal integration token, hardcoded NOTION_TOKEN, delete capability

**Notion Tools**:
The six agent operations for reading and writing a user's notes: search, get page, query database, create page, update page, and append content.
_Avoid_: comments, user information, workspace administration
