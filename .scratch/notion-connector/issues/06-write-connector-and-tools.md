# 06 — Write Connector and Tools

**What to build:** The connector and the researcher can prepare writes: append content to a page, update a page, and create a new page (New Page Placement: as a child of a user-specified authorized page, or at the top level of the workspace per instruction). The three write tools are registered, enabled with `'notion'` + a connection, and their write target is restricted to pages selected in the current conversation. Operations are staged for confirmation, never executed directly.

**Blocked by:** 03 — Read Connector, 04 — @Notion In-Conversation Selection

**Status:** ready-for-agent

- [ ] The connector implements append (block children), update (page content), and create (child page and workspace-top-level parents) with unit tests at the HTTP boundary.
- [ ] Workspace-top-level creation is verified against the integration's allowed parents; if unsupported, the tool asks the user for an authorized parent page instead (documented fallback).
- [ ] The three write tools are registered and enabled only with `'notion'` + a connection; each validates that its target is a page selected in the current conversation.
- [ ] Write operations return a staged write plan (target, placement, content) instead of executing; nothing is written without confirmation.
