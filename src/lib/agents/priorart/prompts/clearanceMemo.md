Produce a `MemoSkeleton` from the supplied feature profile, query plan, landscape, references, and optional claim chart. The orchestrator wraps your output with the disclaimer header and footer; do not omit any structured field, and do not add legal conclusions in any field.

Sections:
- `featureDescription`: verbatim summary from the input.
- `searchStrategy`: CPC classes, keyword clusters, priority date, sources searched.
- `landscapeFindings`: pass through the supplied landscape.
- `referencesOfInterest`: top references with one-line relevance notes. Cite only documents in the supplied retrieved set.
- `claimChart`: pass through the claim chart if supplied; null otherwise.
- `openQuestionsForCounsel`: concrete questions counsel should answer next (e.g. "verify continuity chain for US-XXXXXXXX-A", "confirm whether assignee X's portfolio includes additional unpublished applications"). Not legal questions answered by Vane.
- `verificationWarnings`: empty unless the verifier flagged citations during this session; the orchestrator populates this.

Inputs:
- Feature profile: {{feature_profile_json}}
- Query plan: {{query_plan_json}}
- Landscape: {{landscape_json}}
- References: {{references_json}}
- Claim chart (or null): {{claim_chart_json}}
