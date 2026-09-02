# 08 — Connection & OAuth Hardening

**What to build:** Harden the token/connection/OAuth layer so crypto failures are distinguishable from "not connected", tampered tokens are rejected at the boundary, and concurrent authorization flows cannot clobber each other's state. All three items come from cubic-dev-ai[bot] review comments folded into PR2 (`docs/review-fixes.md` → P2 `#2`, `#11`, `#12`).

**Blocked by:** 01 — Notion Connection Infrastructure, 02 — OAuth Connect Flow（PR1 已完成）

**Status:** ready-for-agent

- [ ] `token.ts` — `setAuthTag` rejects GCM tags that are not exactly 16 bytes; a tampered/short tag fails decryption loudly instead of being accepted (unit test at the boundary).
- [ ] Decryption failure surfaces a distinct error (e.g. `NotionTokenError`), NOT mislabeled as `NotionNotConnectedError`, so callers can tell "no connection" apart from "token corrupted / key changed".
- [ ] The callback/status path maps the decryption error to a clear message — Settings UI shows "stored token cannot be decrypted → disconnect and reconnect" (copy already exists in README).
- [ ] OAuth state is keyed per authorization (state-keyed cookies or server-side state) — a second authorization cannot overwrite an in-flight first one, and the stale flow's callback is rejected.
