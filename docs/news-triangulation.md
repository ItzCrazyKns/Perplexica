# Project: News Triangulation & Neutralization Mode for Perplexica

## 1. Overview

**Working name:** `Triangulate News` / `News Neutralizer` mode  
**Target app:** Perplexica (open-source Perplexity-style search)  
**Goal:** Help users understand how different outlets report on the same event by:
- Fetching a *broad* set of news articles from multiple engines via SearXNG.
- Balancing coverage across different “lanes” (e.g., left / right / center / unknown) without being partisan.
- Extracting structured claims from each article.
- Building a *claim graph* across sources to identify:
  - **Shared facts** (high agreement)
  - **Conflicting details**
  - **Unique angles / outlier claims**
- Presenting a neutral summary plus per-source breakdown with full citations.

The feature is intentionally **politically agnostic**: it highlights structure and divergence in reporting, not “truth scores” or outlet rankings.

---

## 2. High-Level Architecture

### 2.1 Data Flow (Backend)

1. **User query** → `/api/search` with `focusMode: "triangulate_news"` (or similar).
2. **Meta Search Agent** (`src/lib/search/metaSearchAgent.ts`):
   - Detects `triangulate_news` mode.
   - Calls a new internal function (e.g., `performNewsTriangulation(query, options)`).
3. **News Triangulation Pipeline** (`src/lib/search/newsTriangulate.ts` or similar):
   1. **Broad fetch via SearXNG** using news-focused engines/categories.
   2. **Domain dedupe & per-domain cap** (e.g., max 1–2 results per domain).
   3. **Bias tagging** at the domain level (using a lookup table + heuristics).
   4. **Lane balancing**: sample a roughly balanced set from Right/Left/Center/Unknown “lanes”.
   5. **Claim extraction**: for each article, call the LLM with a prompt that returns structured JSON claims.
   6. **Claim graph building**:
      - Convert claims to embeddings.
      - Cluster similar claims.
      - Associate each cluster with contributing outlets and lanes.
   7. **Triangulated summary generation**:
      - Shared facts (high cluster agreement across lanes).
      - Conflicts (clusters with contradictory details).
      - Unique angles (clusters dominated by a single outlet/lane).
   8. **Response assembly**: return a structured JSON payload for the UI.
4. `/api/search` returns:
   - `summary` (neutral, high-level narrative).
   - `sharedFacts[]`.
   - `conflicts[]`.
   - `uniqueAngles[]`.
   - `lanes[]` (aggregated lane stats).
   - `sources[]` (per-outlet claims + metadata).

### 2.2 Data Flow (Frontend)

1. User selects **“Triangulate News”** mode in the UI (new focus mode option).
2. Frontend calls `/api/search` with the mode.
3. UI renders:
   - Top section: neutral summary.
   - Panels/sections:
     - **Shared Facts** (with per-source citations).
     - **Conflicting Details / Uncertainties**.
     - **Unique Angles / Outlier Claims**.
   - Sidebar or footer: lane representation (e.g., counts / percentages of sources by lane).
   - Per-source cards with:
     - Outlet name + domain.
     - Headline.
     - Lane tag (L/R/C/Unknown) with subtle styling (non-judgmental).
     - Key claims.

---

## 3. Core Concepts

### 3.1 Lanes

A **lane** is a coarse bucket for how a domain tends to position itself politically or editorially:

- `LEFT`
- `RIGHT`
- `CENTER`
- `UNKNOWN`

Lane assignment is **heuristic and best-effort**, not definitive.

### 3.2 Claim

A **claim** is a structured snippet extracted from an article, for example:

```json
{
  "id": "claim-uuid",
  "who": "police spokesperson",
  "what": "reported 3 injuries",
  "when": "2025-03-04",
  "where": "City X",
  "type": "fact",
  "confidence": "high",
  "rawText": "According to the police spokesperson, three people were injured..."
}
```

### 3.3 Claim Cluster

A **claim cluster** represents a group of similar claims across multiple sources after embedding + clustering.

Cluster metadata might include:

```json
{
  "clusterId": "cluster-uuid",
  "representativeText": "Three people were injured in the incident",
  "supportingClaims": [
    { "claimId": "c1", "sourceId": "s1", "lane": "CENTER" },
    { "claimId": "c2", "sourceId": "s5", "lane": "LEFT" }
  ],
  "disagreeingClaims": [
    { "claimId": "c3", "sourceId": "s2", "lane": "RIGHT" }
  ],
  "lanesCovered": ["LEFT", "CENTER", "RIGHT"],
  "agreementLevel": "high|medium|low"
}
```

This is the backbone of:
- Shared facts: clusters with high agreement across multiple lanes.
- Conflicts: clusters with clearly contradictory claims.
- Unique angles: clusters dominated by a single lane/outlet.

---

## 4. Phased Implementation Plan

### Phase 0 – Scaffolding & Mode Wiring

**Goal:** Add the basic plumbing for a new focus mode without changing UX behavior yet.

**Tasks:**
- Add a new focus mode enum/value for `"triangulate_news"` in the search layer.
- Update `metaSearchAgent.ts` to route `triangulate_news` queries to a new function stub (`performNewsTriangulation`).
- Extend `/api/search` to accept the new mode and return a placeholder structure (e.g., empty sections) for now.
- Add basic TypeScript interfaces for:
  - `NewsSource`
  - `Lane`
  - `NewsClaim`
  - `ClaimCluster`
  - `TriangulatedNewsResult`

**Deliverable:** Wireframe path from UI → `/api/search` → new backend function, with types in place.

---

### Phase 1 – Broad Fetch & Source Normalization

**Goal:** Get robust news retrieval working with diversity constraints, but no claim graph yet.

**Tasks:**
- Integrate with SearXNG (reusing existing search utilities) to:
  - Use news-focused engines/categories (e.g., Bing News, Google News if available, others).
  - Fetch ~30–40 results.
- Implement **domain dedupe & per-domain cap**:
  - Identify domain from URL.
  - Enforce max 1–2 articles per domain.
- Implement **basic result normalization**:
  - Common shape: `{ url, title, snippet, timestamp, sourceName, domain }`.

**Deliverable:** Backend function `fetchNormalizedNewsResults(query, options)` that returns a diverse list of news articles from multiple domains.

---

### Phase 2 – Lane / Bias Tagging & Balancing

**Goal:** Attach lane information to each source and select a balanced subset of outlets for triangulation.

**Tasks:**
- Implement **domain-level bias tagging** with a two-tier approach:
  1. **Lookup table** for known domains (stored in JSON or config).
  2. **Heuristic fallback** for unknown domains, based on:
     - Country TLD
     - Presence of words like “opinion” / “editorial” in paths
     - Topic mix (optional, can be deferred).
- Define lane enum: `LEFT`, `RIGHT`, `CENTER`, `UNKNOWN`.
- Implement **lane balancing**:
  - Group normalized results by lane.
  - Sample up to K per lane (e.g., 5–7 per lane), prioritizing:
    - Recency
    - Headline uniqueness
- Return a final list of `NewsSource` objects with lane metadata.

**Deliverable:** `selectBalancedNewsSources(results: NormalizedResult[]): NewsSource[]`.

---

### Phase 3 – Claim Extraction & Claim Graph

**Goal:** Convert article content into structured claims and build a claim graph.

**Tasks:**
- Article text retrieval:
  - Either:
    - Use existing text extraction in Perplexica (if available), or
    - Implement simple readability-style extraction by URL (if not too heavy).
- **Claim extraction with LLM**:
  - For each source, send article text to an LLM with a prompt that returns a JSON list of claims.
  - Enforce a strict JSON schema to avoid hallucinated formats.
- **Embedding and clustering**:
  - Convert each claim into an embedding (reuse existing embedding model provider).
  - Cluster claims using a simple algorithm (e.g., hierarchical clustering, k-means, or threshold-based grouping by cosine similarity).
- Build **claim clusters** and compute:
  - `lanesCovered`
  - `supportingClaims` and any `disagreeingClaims`
  - `agreementLevel` (heuristic based on number/diversity of supporting lanes).

**Deliverable:**

- `extractClaimsForSources(sources: NewsSource[]): NewsClaim[]`
- `buildClaimClusters(claims: NewsClaim[]): ClaimCluster[]`

---

### Phase 4 – Triangulated Summary & API Response

**Goal:** Transform the claim graph into a user-facing structure.

**Tasks:**
- From `ClaimCluster[]`, derive:
  - `sharedFacts[]`: clusters with high agreement across multiple lanes.
  - `conflicts[]`: clusters where claims contradict (e.g., different numbers, causes, or timelines).
  - `uniqueAngles[]`: clusters dominated by one lane or outlet.
- Generate a **neutral top-level summary** via LLM using:
  - Key shared facts
  - Acknowledged uncertainties
  - High-level lane coverage
- Assemble a final `TriangulatedNewsResult` object with:
  - `summary`
  - `sharedFacts[]`
  - `conflicts[]`
  - `uniqueAngles[]`
  - `lanes[]` (aggregate stats: e.g., source count per lane)
  - `sources[]` (per-outlet claims, lane, URLs).

- Update `/api/search` to return this structure only in `triangulate_news` mode.

**Deliverable:** Fully populated backend response ready for UI integration.

---

### Phase 5 – UI / UX Integration

**Goal:** Expose the feature to users and present the data meaningfully.

**Tasks:**
- UI control changes:
  - Add a **“Triangulate News”** focus/mode option alongside existing search modes.
- New results layout (Next.js pages + components):
  - Top section: neutral summary text.
  - Sections:
    - **Shared Facts** (bullets, each with per-source citations and lane coverage indicators).
    - **Conflicting Details / Uncertainties**.
    - **Unique Angles**.
  - Lane indicator component:
    - Simple visualization (e.g., counts or small bar for L/R/C/Unknown).
  - Source cards:
    - Outlet name + domain.
    - Lane tag (subtle, not shouting politics).
    - Key 2–4 claims.
    - Link to full article.
- Responsive design and graceful fallback when fewer sources/lanes are available.

**Deliverable:** New UI mode that cleanly uses the `TriangulatedNewsResult` and feels native to Perplexica.

---

### Phase 6 – Evaluation, Logging & Iteration

**Goal:** Make the feature debuggable, tunable, and safe.

**Tasks:**
- Logging:
  - Log anonymized stats (e.g., number of sources, lane distribution, cluster counts) for debugging.
- Telemetry hooks (if accepted by maintainers):
  - Track usage of `triangulate_news` mode.
- Quality tuning:
  - Adjust:
    - K (number of sources per lane).
    - Clustering thresholds.
    - Claim extraction prompt.
    - Thresholds for promoting a cluster to shared fact vs conflict.
- Edge cases & robustness:
  - No news results.
  - All results from one lane.
  - Very long or very short articles.
  - LLM extraction failures (fallback messaging).

**Deliverable:** A feature that can be monitored, tuned, and improved over time, not a one-off experiment.

---

## 5. Non-Goals

- Determining which outlet is “correct” or “trustworthy”.
- Assigning fine-grained ideological scores beyond coarse lanes.
- Moderating or censoring content beyond existing project policies.
- Serving as a fact-checking authority.

The system’s job is **comparative structure & transparency**, not adjudication.

---

## 6. Suggested File & API Additions (for Cursor / Implementation)

- `src/lib/search/newsTriangulate.ts`
  - `fetchNormalizedNewsResults`
  - `selectBalancedNewsSources`
  - `extractClaimsForSources`
  - `buildClaimClusters`
  - `buildTriangulatedNewsResult`

- `src/types/newsTriangulate.ts` (or similar)
  - `Lane`
  - `NewsSource`
  - `NewsClaim`
  - `ClaimCluster`
  - `TriangulatedNewsResult`

- `src/app/api/search/route.ts`
  - Extend handler to route `focusMode: "triangulate_news"` to `performNewsTriangulation`.

- `src/lib/search/metaSearchAgent.ts`
  - Add new focus mode branch.

- `src/app/...` and `src/components/...`
  - New UI components for the Triangulate News mode.

---

## 7. How to Hand This to Cursor

You can give Cursor this file as a **high-level architecture spec** and say:

> “Implement Phase 0 and Phase 1 of this `Triangulate News` mode inside the Perplexica repo. Start with the types, the new focus mode wiring, and the broad news fetch + domain dedupe utilities, following this architecture.”

Then iterate phase-by-phase, using this spec as the north star.
