# 04 — @Notion In-Conversation Selection

**What to build:** A user activates Notion inside a single conversation: a page picker lists Authorized Pages, and typing `@Notion 頁面名` also works. The chosen page(s) become a chip in the input; the mention is stripped from the message; activating the source marks the chat with the `'notion'` source and persists the selected pages per chat. Without a connection, one inline hint points to Settings — no pop-up, no repeated asking.

**Blocked by:** 02 — OAuth Connect Flow, 03 — Read Connector

**Status:** ready-for-agent

- [ ] The page picker lists authorized pages (from the connector) with a fuzzy filter; picking one adds it to the input as a chip.
- [ ] Typing `@Notion <name>` is detected at submit, the mention is stripped from content, and the name is resolved through Fuzzy Page Search; ambiguity or no match surfaces candidates for the user to pick.
- [ ] Activating Notion adds `'notion'` to the chat's sources and persists the selected pages with the chat; reloading the chat restores them.
- [ ] With no connection, using `@Notion` shows one inline hint linking to Settings and nothing else; no OAuth flow is ever triggered from the chat.
