# 05 — Read Agent Tools

**What to build:** The researcher can use Notion during a chat. Three tools — notion_search, notion_get_page, notion_query_database — are registered in the research-action registry, enabled only when the `'notion'` source is active and a connection exists, and their results flow into the final answer as findings. When a page name fails to resolve, the agent asks the user to confirm with candidates rather than guessing. End-to-end: "用 @Notion 讀《會議筆記》" answers from that page.

**Blocked by:** 03 — Read Connector, 04 — @Notion In-Conversation Selection

**Status:** ready-for-agent

- [ ] `'notion'` is a valid chat source end-to-end (type, chat schema, request validation all accept it).
- [ ] The three read tools are registered with schemas and descriptions; each is enabled only when the source is active and a connection exists; each executes through the read connector and returns findings that reach the writer prompt.
- [ ] The classifier's personal-search path routes `@Notion` requests to these tools (no new parallel classifier branch).
- [ ] When Fuzzy Page Search cannot resolve the target, the agent responds with candidate pages and asks the user to choose — it never silently reads another page.
- [ ] Manual verification: a chat selecting a page and asking a question answers from that page's content.
