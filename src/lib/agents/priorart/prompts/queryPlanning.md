Produce a `QueryPlan` for the feature profile and optional claim text below.

Requirements:
- `odpQueries`: Boolean queries for USPTO ODP. Use AND/OR/NOT and quoted phrases. Annotate each with its target field (title / abstract / claims / fullText / any). Prefer narrow, high-precision queries; the orchestrator runs several in parallel.
- `bigqueryFragments`: SQL WHERE fragments with `@pN` parameter placeholders. The caller binds parameters server-side; never inline literals into SQL. Fragments combine with the orchestrator's outer LIMIT and date-bound clauses.
- `semanticQueries`: short embedding-search strings, complementary to the Boolean queries (cover the same intent with different phrasing).
- `cpcClasses`: candidate CPC class strings (prefix-match in BigQuery).
- `priorityDate`: echo the supplied priority date in ISO YYYY-MM-DD.

If claim text is supplied, weight queries toward the recited elements. If not, weight toward `technicalElements` and `componentTechnologies` in the feature profile.

Feature profile:
{{feature_profile_json}}

Optional draft claim:
{{claim_text}}

Priority date:
{{priority_date}}
