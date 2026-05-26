# Prior Art Mode

> Research artifact, not legal opinion. Counsel review required.

A Vane mode that produces patent prior-art research artifacts for Switchyard feature clearance. Fuses USPTO Open Data Portal + Google Patents BigQuery + local Transformer embeddings, applies a strict §102 date guard, verifies LLM-emitted citations, and renders a clearance memo skeleton.

## What this mode is and isn't

Vane produces **research artifacts** for internal Allodial use and counsel review. Vane does **not** produce legal opinions, freedom-to-operate conclusions, or patentability determinations. That language appears verbatim in this doc and in every generated memo.

## Setup

### 1. Credentials

- **USPTO ODP API key** — get one at https://developer.uspto.gov/. Set `USPTO_ODP_API_KEY` in your shell or paste into Settings → Prior Art.
- **GCP project** with BigQuery enabled. Set `GCP_PROJECT_ID` and either set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON or rely on Application Default Credentials (the docker-compose mounts `~/.config/gcloud` read-only into the container).

### 2. Database migration

The container applies Drizzle migrations on startup. After rebuilding the image, the `priorart_workspaces` and `priorart_documents` tables exist automatically.

### 3. Rebuild the image

```bash
docker compose -f /Users/office.host/Projects/vane/docker-compose.yaml up -d --build
```

### 4. Verify

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/priorart   # → 200
```

## Usage

### Web UI

Open http://localhost:3000/priorart. Paste a Switchyard feature description (markdown / PRD excerpt), optionally a draft claim and priority date, then click **Run clearance** or **Landscape only**.

### CLI

The CLI is a `tsx` shim that runs against the same code as the API routes. From the project root:

```bash
yarn priorart clear \
  --feature-file tests/priorart/fixtures/switchyard_feature_sample.md \
  --priority-date 2026-06-01

yarn priorart landscape --feature-file path/to/feature.md

yarn priorart search --query "vector similarity search merkle commitment" \
  --cpc G06F16 --limit 50

yarn priorart fetch --publication US-20210123456-A1
```

Artifacts land in `<workspacePath>/<feature-id>/<timestamp>/`:
- `memo.md` — clearance memo skeleton (with disclaimer header + footer)
- `memo.json` — full structured bundle (profile, plan, refs, memo, warnings)
- `claim_chart.md` — claim chart in markdown (when `--claim-file` was passed)

### API

```bash
curl -X POST http://localhost:3000/api/priorart/clear \
  -H 'Content-Type: application/json' \
  -d '{"featureDescription":"…","claimText":"…","priorityDate":"2026-06-01"}'
```

Other endpoints:
- `POST /api/priorart/landscape`
- `POST /api/priorart/search` (`{ query, cpcClasses?, limit?, priorityDate? }`)
- `POST /api/priorart/fetch` (`{ identifier }`)

## Cost guidance (BigQuery)

Every BigQuery query goes through a dry-run estimate before execution. If the estimate exceeds `bigqueryBytesBilledCap` (default 1 GB), the query is **refused before billing** and the orchestrator returns the partial set from ODP alone.

Tune the cap in Settings → Prior Art → BigQuery Bytes-Billed Cap. Recommended ceilings:
- Exploratory landscapes: 1 GB
- Targeted searches: 250 MB
- CPC-filtered narrow queries: 100 MB

`patents-public-data.patents.publications` is large; broad keyword scans can scan 100+ GB if you bypass the cap.

## Architecture

```
src/lib/agents/priorart/
├── orchestrator.ts          7-step state machine
├── schemas.ts               zod models (FeatureProfile, QueryPlan, PatentDocument, ClaimChart, MemoSkeleton)
├── render.ts                markdown rendering
├── runtime.ts               builds OrchestratorConfig from ConfigManager
├── configSection.ts         Settings UI fields + defaults
├── sources/                 base.ts, usptoOdp.ts, bigqueryPatents.ts
├── retrieval/               queryPlanner.ts, embeddings.ts, fuser.ts
├── analysis/                featureParser.ts, dateGuard.ts, verifier.ts, landscape.ts, claimChart.ts
└── prompts/                 system.md, queryPlanning.md, featureExtraction.md, claimAnalysis.md, landscapeSynthesis.md, clearanceMemo.md
```

State machine steps:
1. Parse feature description → `FeatureProfile` (LLM).
2. Plan queries → `QueryPlan` (LLM).
3. Parallel retrieval from ODP + BigQuery.
4. Date guard (strict-before §102).
5. Local embedding + semantic recall, then reciprocal rank fusion (k=60) with family-prefix dedup.
6. Landscape synthesis. Claim chart (if claim supplied). Verifier strips fabricated citations.
7. Render memo.md, memo.json, and (optionally) claim_chart.md to the per-run workspace directory.

## Hard guarantees

- **Date guard**: any reference with `publication_date >= priority_date` AND `filing_date >= priority_date` is excluded. Equal dates excluded. Tested.
- **Verifier**: every LLM-emitted publication number must either appear in the retrieved set or resolve via a source `fetch()`. Unverified citations are replaced with a sentinel and recorded in `verification_warnings`.
- **BigQuery cost guard**: dry-run before every query; refused above cap; logged.
- **No secrets in logs**: ODP `x-api-key` is scrubbed from error messages.
- **Memo disclaimer**: header and footer carry `Research artifact, not legal opinion. Counsel review required.` This is enforced in render code and tested.
- **OA legacy host flag**: `oaUseLegacyHost` defaults true; OA endpoints hit `developer.uspto.gov` until USPTO completes migration.

## Scope and limitations (v1)

- Patent literature only (USPTO + BigQuery Patents Public Data). No IEEE, arXiv, GitHub.
- No foreign-language translation.
- Embeddings cover title + abstract + first independent claim only.
- Family resolution is publication-number-prefix only; full INPADOC family resolution is v2.
- No invalidity chart generation for adverse art.
- No legal opinions of any kind — that's counsel's job.

## Running tests

```bash
yarn test                                    # unit tests (no live APIs)
RUN_INTEGRATION_TESTS=1 yarn test            # add live ODP + BigQuery integration suite
```
