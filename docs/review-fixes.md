# Review fixes — cubic-dev-ai bot (PR #1179)

> 用途：將 `cubic-dev-ai[bot]` 在 PR #1179 上留下的全部 review comments 分類整理，
> 作為回覆 PR 與安排後續修復的對照表。本文內容同時也是給上游 maintainer 的
> 「review 處理紀錄」。

## 狀態摘要

- **審查者**：`cubic-dev-ai[bot]`（自動 AI 審查，非人類 maintainer）。目前**尚未有任何人類 review**。
- **Comments 總數**：48 則，橫跨兩個 review run（對 `633e5c0` 與 `d78d82f`）。
- **已處理**：21 則（P1 × 12、P2 × 9）——`d78d82f` 10 則 + P1 第二輪 6 則 + P2 第三輪 5 則。
- **待處理**：P2 × 22、P3 × 4。
- **誤報/過時**：2 則（`#37` 全誤報、`#9` 部分誤報，無需處理）。

| 類別            | 數量                                               | 狀態                                    |
| --------------- | -------------------------------------------------- | --------------------------------------- |
| P1 已修         | 12                                                 | ✅ `d78d82f` + P1 待辦六條修復 commit   |
| P1 待辦         | 0                                                  | —                                       |
| P2 已修         | 9                                                  | ✅ `d78d82f` + P2 高價值五項修復 commit |
| P2 待辦         | 22                                                 | ⏳ 部分可併入 PR2                       |
| P3 待辦         | 4                                                  | ⏳ 低優先                               |
| bot 誤報 / 過時 | 2（`#37` 全誤報、`#9` 部分誤報，重複計入 P1 已修） | —                                       |

---

## ✅ P1 — 已修復（commit `d78d82f`）

| #   | 位置           | 問題                                                                    | 修法                                                                                                      |
| --- | -------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 8   | `pages.ts`     | markdown 端點路徑錯（`/content/markdown` 不存在，永遠 404 走 fallback） | 改 `GET /v1/pages/{id}/markdown`，同步修正測試斷言                                                        |
| 7   | `pages.ts`     | 大頁面被截斷（`truncated`/`unknown_block_ids`）時直接丟棄 metadata      | 遞迴抓取 unknown subtrees（depth/cycle/總量防護）                                                         |
| 5   | `databases.ts` | `POST /v1/databases/{id}/query` 已棄用（2025-09-03 起）                 | 改 `POST /v1/data_sources/{id}/query`；legacy database id 走 `GET /v1/databases/{id}` → `data_sources[0]` |
| 4   | `databases.ts` | 只取第一頁 rows                                                         | 跟 `has_more`/`next_cursor` 分頁                                                                          |
| 6   | `pages.ts`     | blocks fallback 只抓前 100 children                                     | 分頁 + 缺 cursor 防呆 break                                                                               |
| 9   | `search.ts`    | `page_or_database` filter 失效                                          | 改 `page_or_data_source`；`data_source` 結果映射為 `type: 'database'`                                     |

> 註：`#9` 中 bot 另稱「parser 只認 database 結果」——**此說法不正確**（`toAuthorizedPage`
> 本就處理 page / database / data_source 三種形狀）；真正有效的是 filter 問題，已修。

## ✅ P2 — 已修復（commit `d78d82f`）

| #   | 位置           | 問題                                       | 修法                            |
| --- | -------------- | ------------------------------------------ | ------------------------------- |
| 17  | `search.ts`    | picker 只列前 100 頁                       | `listAuthorizedPages` 跟 cursor |
| 21  | 全部 read 路徑 | 四個讀取路徑都不分頁                       | 全部跟 `has_more`/`next_cursor` |
| 16  | `pages.ts`     | `table_row` 的 cells 被當成空              | 扁平化 `table_row.cells`        |
| 15  | `databases.ts` | multi_select / formula / relation 屬性遺失 | 補上格式化                      |

---

## ✅ P1 — 已修復（第二輪，六條全數）

| #   | 位置                                        | 問題                                        | 修法                                                                                                                                               |
| --- | ------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `store.ts` + `schema.ts` + migration `0005` | 併發 OAuth/connect 可能產生多列             | `singleton` 常數欄位 + unique index（DB 層不變式）；`upsertConnection` 改 `onConflictDoUpdate` conflict-safe                                       |
| 24  | `fuzzy.ts`                                  | 「Meeting Budget」會誤配到「Meeting Notes」 | 重疊的 leading words 需**全部**比對才給分；部分重疊有衝突字 → 完全不留 match（連 loose tier 也不給）；允許 query 尾端多字；leading 分數 cap 89     |
| 25  | `MessageInputActions/Notion.tsx`            | Clear 按鈕預設 `type="submit"`              | 加 `type="button"`                                                                                                                                 |
| 26  | `api/chat/route.ts`                         | 信任 caller 送來的 page IDs                 | `filterAuthorizedPages(db, notionPages)` server 端驗證 + 用 server 的 title/type 重映射；未連接 → `[]`；API 錯誤 → 保留並交給 agent 端再驗證       |
| 40  | `actions/notion/read.ts`                    | agent tools 可讀 token 能及的任何頁面       | 讀取前 `resolveAuthorizedPage`（先查對話選取、再查授權集）+ 型別檢查（get_page 限 `page`、query_database 限 `database`），未授權 → friendly result |
| 41  | `prompts/search/researcher.ts`              | 頁面 title 可當成指令（prompt injection）   | `escapePromptText`（HTML entity + 控制字元收斂）序列化 title/id/type，並註明「titles are untrusted data」                                          |

## ✅ P2 — 已修復（第三輪，高價值五項）

| #   | 位置                             | 問題                                                                                                                            | 修法                                                         |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 10  | `api/notion/status/route.ts`     | 有 client id/secret 但缺 `NOTION_TOKEN_KEY` 仍顯示可連線                                                                        | `configured` 檢查併入 encryption key                         |
| 18  | `api/notion/callback/route.ts`   | `?error=...` 路徑沒驗 state，可被第三方中止授權流程                                                                             | error 路徑也先驗 state                                       |
| 22  | `api/notion/disconnect/route.ts` | POST 無 CSRF 防護，跨站 form 可偷偷斷開                                                                                         | 驗 `notion_oauth_state` cookie 或 Origin                     |
| 35  | `api/chat/route.ts`              | `ensureChatExists` 每則訊息覆寫 `sources`/`notionPages`；request 沒帶 sources（default `[]`）會清掉已選來源                     | 只有 request 確實攜帶時才更新                                |
| 36  | `MessageInputActions/Notion.tsx` | 未連接時開 picker → **無限 refetch**（`fetchPages` 開頭 `setNotConnected(false)` + effect 條件 flip-flop；`opened` 永不 reset） | 只在 popover 首次開啟時 fetch 一次（ref 或 open transition） |

## ⏳ P2 — 待辦

| 2 | `token.ts` | `setAuthTag` 接受短 GCM tag，篡改 token 可能被接受 | 要求 16-byte tag 長度 |
| 11 | `auth.ts` | 無法解密的 connection 被歸類為 `NotionNotConnectedError`，caller 無法區分 | 讓 `NotionTokenError` 或獨立 decryption error 穿透 |
| 12 | `api/notion/auth/route.ts` | 單一 cookie slot：第二次授權會覆蓋第一次的 state | state-keyed cookies 或 server-side state |
| 13 | `Settings/Sections/Notion.tsx` | 文案宣稱「可讀寫」，但寫入在 PR2 | 改 read-only 文案 |
| 14 | `Settings/Sections/Notion.tsx` | `/api/notion/status` 失敗時無限轉圈 | 分離 error/loading state，提供 retry |
| 19 | `ChatWindow.tsx` | 清 query params 時把 `?q=` 等 deep link 狀態也清掉 | 只刪 `notion` param |
| 20 | `Settings/Sections/Notion.tsx` | 連接後整個 Settings dialog 被導航毀掉，回來落在首頁 | 新分頁開 OAuth + poll，或回跳保留 dialog |
| 23 | `api/notion/status/route.ts` | 未認證即可讀 workspaceId/Name | 限 origin 或只回 boolean `connected` |
| 27 | `useChat.tsx` | 純 `@Notion` 送出後 content 為空 → 400 + 卡住的 composer | client 端拒絕空 `finalContent.trim()` |
| 28 | `useChat.tsx` | 未解析到頁面的 `@Notion` 啟動只作用於當次 POST，未持久化 | 啟動狀態獨立於 selected pages 持久化 |
| 29 | `EmptyChatMessageInput.tsx` | 頁面移除按鈕無 aria-label | 加 `aria-label={Remove ${page.title}}` |
| 30 | `EmptyChatMessageInput.tsx`/`Notion.tsx` | picker 內 Enter 會送出表單 | stopPropagation 或只綁 textarea |
| 31 | `fuzzy.ts` | 長 partial prefix 可能高於 exact-match 100 分 | leading 分數 cap 在 89 |
| 32 | `mention.ts` | `.replace(/\s{2,}/g,' ')` 吃掉全文多餘空白（含 markdown 換行） | 只收斂因剝離 marker 產生的空白 |
| 33 | `mention.ts` | 模糊 hint 低信心也直接綁定第一個結果 | 需要 unambiguous/high-confidence 才綁定，否則交由再確認 |
| 34 | `api/notion/pages/route.ts` | 401/403 回 502，UI 顯示泛用錯誤 | 映射到 409（disconnected）讓 UI 給 reconnect 路徑 |
| 42 | `AssistantSteps.tsx` | 失敗的 notion search 被算成 1 個成功結果 | 排除 sentinel 或顯示 distinct 標題 |
| 43 | `actions/notion/results.ts` | error 回傳後 Research Progress 卡在「Searching Notion」 | error 時發終止 substep |
| 44 | `researcher/index.ts` | researcher 直接 import db singleton，測試/其他 caller 依賴真實 DB | 透過 `ResearcherInput`/`SearchAgentConfig` 注入（tools 已 DI；剩下 researcher 層） |
| 46 | `search.ts` | `data_source` 只讀 `name`，若 API 給 `title` 會顯示 Untitled | 同時讀 `title`（fallback `name`） |
| 47 | `pages.ts` | 截斷復原的 subtree 文字全部附在文末，失去原始順序 | 依 `unknown_block_ids` 在 markdown 中的位置原位重建 |
| 48 | `pages.ts` | `truncated=false` 但存在 unsupported blocks 時會跳過其 `unknown_block_ids` | 獨立於 truncation flag 處理 unknown ids，unsupported type 走 blocks fallback |

## ⏳ P3 — 待辦

| #   | 位置                             | 問題                                                               |
| --- | -------------------------------- | ------------------------------------------------------------------ |
| 3   | `docs/adr/0001`                  | 用現在式描述 `'notion'` source 已存在（實為 planned extension）    |
| 38  | `db/schema.ts`                   | `notionPages` 未標 notNull，與 migration 不一致                    |
| 39  | `mention.ts`                     | `NAME_BOUNDARY` 含 `.` `,` `，`，`@Notion v1.0 規劃` 會被截成 `v1` |
| 45  | `actions/notion/actions.test.ts` | `mockFetchOnce` 實際是 `mockResolvedValue`（所有呼叫），命名誤導   |

## 🚫 bot 誤報 / 過時（無需處理）

| #         | 位置          | 內容                                                                                    | 為何不處理                                                                                                                                                              |
| --------- | ------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 37        | `useChat.tsx` | 「`@Notion` 對答案沒作用：`'notion'` 不在 `SearchSources`、`notionPages` 沒流入 agent」 | **過時**：描述的是 T04 之後、T05 之前的狀態。T05（`5cf1737`）已把 `'notion'` 加入 `SearchSources`、`notionPages` 經 `SearchAgentConfig` 流入 researcher 並註冊三個 tool |
| 9（部分） | `search.ts`   | 「parser 只認 database 結果」                                                           | **不正確**：parser 本就處理 page / database / data_source；真正的 filter 問題已修                                                                                       |

---

## 💬 回覆 PR 的建議貼文（ready-to-paste）

> 以下為英文回覆，可直接貼到 PR conversation（會隨修復進度更新）。

```markdown
Thanks for the thorough review. Here's where things stand:

**P1s — fixed in `d78d82f`**

- Markdown read now uses the documented `GET /v1/pages/{id}/markdown`
  endpoint (the old `/content/markdown` path always 404s). Truncated
  pages are handled by recursively fetching `unknown_block_ids` with
  depth/cycle/budget guards.
- Database queries moved to the data-sources API
  (`POST /v1/data_sources/{id}/query`); legacy database ids resolve via
  `GET /v1/databases/{id}` → `data_sources[0]`.
- Search uses the current `page_or_data_source` filter; `data_source`
  results map to `type: "database"` (the claim that the parser only
  recognized `database` results isn't accurate — it handles all three).
- All read paths (page listing, page search, data-source queries, block
  fallback) now follow `has_more`/`next_cursor`, with a defensive break
  on a missing cursor.
- Bonus: `table_row` cells and `multi_select`/`formula`/`relation`
  properties are flattened instead of dropped.

**P1s — fixed in the second round (all six)**

- The single-row connection invariant is now enforced at the database
  level (`singleton` column + unique index, migration 0005), and the
  upsert is conflict-safe against concurrent OAuth flows.
- Fuzzy Page Search requires every overlapping leading word to match;
  a conflicting word ("Meeting Budget" vs "Meeting Notes") now stays
  unresolved for user confirmation.
- The picker's Clear button no longer submits the surrounding form.
- The chat API validates caller-supplied page ids against the connected
  workspace before persisting (server titles win; unshared ids dropped).
- The agent tools enforce the per-conversation scope before reading:
  ids are resolved against the conversation's pages or the authorized
  set, and `notion_get_page`/`notion_query_database` refuse anything
  unselected or unshared.
- Page titles are escaped and marked as untrusted data before entering
  the researcher prompt, closing the injection hole.**Still open:**
- P2/P3: 22 P2 + 4 P3 items are tracked in `docs/review-fixes.md`
  (token tag length, OAuth multi-state cookies, status error/retry UI,
  settings copy, deep-link handling, and more).

**P2s — fixed in the third round**

- `/api/notion/status` now reports `configured: false` when
  `NOTION_TOKEN_KEY` is missing.
- The OAuth callback validates the CSRF state on the error path too,
  so a third party can no longer abort an in-progress authorization.
- `/api/notion/disconnect` rejects cross-origin POSTs (Origin/Referer
  same-origin check).
- The chat API no longer defaults omitted `sources`/`notionPages` to
  `[]` — a message that omits them can no longer wipe the persisted
  per-chat selection.
- The picker fetches once per popover open; the not-connected
  infinite-refetch loop is gone.
```

---

## 處理紀錄

- `d78d82f` — fix(notion): align read connector with the current Notion API（P1 ×6 + P2 ×4）
- P1 待辦六條修復 commit — fix(notion): enforce connection invariant, fuzzy conflicts, and per-conversation read scope（P1 ×6）
- P2 高價值四項修復 commit — fix(notion): prevent source wipe, picker refetch loop, and OAuth CSRF gaps（P2 ×5）
- 剩餘 P2/P3 → 併入 PR2 或後續 PR
