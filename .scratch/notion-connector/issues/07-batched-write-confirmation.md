# 07 — Batched Write Confirmation

**What to build:** The interactive Write Confirmation: all staged writes in one response appear in a single card (targets, placement, content preview) with Approve / Reject. When a same-named page already exists at the target, the card offers create-duplicate / write-into-existing / cancel. Approving executes all writes through the connector and reports results; rejecting cancels them. The response pipeline pauses for the user's choice — an interactive, awaitable block in Vane's streaming response.

**Blocked by:** 06 — Write Connector and Tools

**Status:** ready-for-agent

- [ ] The streaming response can emit a confirmation block, pause, and resume after the user's choice (one card per response, never one per operation).
- [ ] The card shows every pending write with its target page, placement, and content preview, plus Approve / Reject.
- [ ] Name-collision detection per target offers create-duplicate / write-into-existing / cancel, defaulting to the safest option.
- [ ] Approve executes the batch via the write connector and streams the results into the response; Reject cancels the batch with nothing written.
- [ ] Manual verification: asking Vane to save a summary into a named page produces exactly one card; approving writes once and reports the page links.
