const SYSTEM = `You are a prior art research assistant operating inside Vane. You produce structured research artifacts for Allodial counsel review. You are not a lawyer and you do not produce legal opinions, freedom-to-operate conclusions, or patentability determinations. Every artifact you emit is labeled as a research artifact, not a legal opinion.

You only cite documents that have been retrieved during this session and that resolve to real records via USPTO ODP or Google Patents BigQuery. You never fabricate publication numbers, dates, assignees, or quotes. If you are uncertain about a citation, you omit it.

You respect §102 strict-before dating: references with publication or filing dates equal to or later than the priority date are excluded from prior art consideration.

You output JSON that matches the schema you are given. If a field is unknown, leave it empty rather than guessing.
`;

const FEATURE_EXTRACTION = `Extract a structured \`FeatureProfile\` from the Switchyard feature description below. This profile is the bridge between product language and patent-language search queries. Treat this as the highest-leverage step of the pipeline.

Requirements:
- \`technicalElements\`: enumerate each separable technical contribution. For each, write a short novelty hypothesis describing what prior art it appears to improve over. Be concrete and patent-like in phrasing.
- \`cpcClassesSuggested\`: propose CPC classes you would search. Do not validate; downstream code does not assume these are correct.
- \`keywordClusters\`: group SEO-friendly keywords by sub-topic so each cluster maps to a coherent Boolean query.
- \`semanticQueries\`: short natural-language strings suitable for embedding-based similarity recall.
- \`componentTechnologies\`: the underlying primitives this feature composes (e.g. "vector similarity search", "real-time event routing", "merkle-tree state commitment"). Used for landscape clustering.
- \`featureId\`: kebab-case slug derived from the title; stable across runs.

Do not include legal conclusions. Do not assert novelty as fact — only hypothesize.

Feature description:
{{feature_description}}
`;

const QUERY_PLANNING = `Produce a \`QueryPlan\` for the feature profile and optional claim text below.

Requirements:
- \`odpQueries\`: queries for USPTO ODP. **DO NOT use quoted phrases or AND/OR/NOT operators** — ODP returns 404 on those. Use plain whitespace-separated keywords ONLY. For each entry set \`field: "any"\` and \`query: "keyword1 keyword2 keyword3"\`. Example: \`{"field":"any","query":"GPU inference admission control"}\`. 5-8 entries total.
- \`bigqueryFragments\`: SQL WHERE fragments referencing ONLY these columns from \`patents-public-data.patents.publications\`:
    * \`publication_number\` (STRING)
    * \`application_number\` (STRING)
    * \`title_localized\` (array of struct{language, text}) — use \`EXISTS (SELECT 1 FROM UNNEST(title_localized) t WHERE LOWER(t.text) LIKE @paramName)\`
    * \`abstract_localized\` (array of struct{language, text}) — same UNNEST pattern
    * \`filing_date\`, \`publication_date\`, \`priority_date\` (all INT64 in YYYYMMDD format)
    * \`assignee_harmonized\` (array of struct{name}) — UNNEST pattern
    * \`cpc\` (array of struct{code}) — UNNEST pattern
  **Never reference a bare column named \`publication\`, \`title\`, \`abstract\`, \`claims\`, \`assignee\`, or any column not in the list above.** Use ONLY \`LOWER(...) LIKE @paramName\` for text search. Parameters use \`@\` placeholders (e.g. \`@term0\`, \`@term1\`) — each unique name appears once across all fragments. 3-6 entries total.
- \`semanticQueries\`: 3-6 short natural-language phrases for embedding search. Different phrasing from the Boolean queries.
- \`cpcClasses\`: 2-5 CPC class prefix candidates. **Use only the section letter and subclass (e.g. "G06F", "G06N", "H04L")** — NOT full classifications like "G06F16/00" with slash, because the orchestrator does STARTS_WITH match.
- \`priorityDate\`: echo the supplied priority date in ISO YYYY-MM-DD.

If claim text is supplied, weight queries toward the recited elements. If not, weight toward \`technicalElements\` and \`componentTechnologies\` in the feature profile.

Feature profile:
{{feature_profile_json}}

Optional draft claim:
{{claim_text}}

Priority date:
{{priority_date}}
`;

const CLAIM_ANALYSIS = `Produce a \`ClaimChart\` mapping each element of the subject claim to the most relevant of the supplied references.

Rules:
- Only cite documents present in the supplied reference list. Never cite anything else.
- Pinpoint citations: column/line for US patents, paragraph number for publications. If unknown, omit the mapping entry rather than guessing.
- Quote the relevant excerpt verbatim from the reference where possible. If the excerpt would be fabricated, omit it.
- Note distinctions between the element and the cited art in \`notes\` when the mapping is imperfect.
- Do not draw legal conclusions about anticipation or obviousness. This is a research mapping, not an opinion.

Subject claim:
{{claim_text}}

References (post-fusion top K):
{{references_json}}
`;

const LANDSCAPE_SYNTHESIS = `Produce a \`Landscape\` summary over the supplied retrieved set.

Requirements:
- \`topAssignees\`: top 10 by document count, with earliest/latest filing dates where available.
- \`cpcDistribution\`: top CPC classes by document count.
- \`highlyCitedReferences\`: documents with notable forward-citation counts in the retrieved set.
- \`citationClusters\`: groups of references that cite each other or share assignees and CPC classes; label each cluster descriptively.
- \`whitespaceCandidates\`: component-technology combinations sparsely represented in the retrieved set. Be specific; vague observations are not useful.

Do not editorialize. Do not suggest the feature is patentable or unpatentable. Produce structured findings only.

Retrieved set (post date-guard, post-fusion):
{{documents_json}}

Component technologies declared in the feature profile:
{{component_technologies_json}}
`;

const CLEARANCE_MEMO = `Produce a \`MemoSkeleton\` from the supplied feature profile, query plan, landscape, references, and optional claim chart. The orchestrator wraps your output with the disclaimer header and footer; do not omit any structured field, and do not add legal conclusions in any field.

Sections:
- \`featureDescription\`: verbatim summary from the input.
- \`searchStrategy\`: CPC classes, keyword clusters, priority date, sources searched.
- \`landscapeFindings\`: pass through the supplied landscape.
- \`referencesOfInterest\`: top references with one-line relevance notes. Cite only documents in the supplied retrieved set.
- \`claimChart\`: pass through the claim chart if supplied; null otherwise.
- \`openQuestionsForCounsel\`: concrete questions counsel should answer next (e.g. "verify continuity chain for US-XXXXXXXX-A", "confirm whether assignee X's portfolio includes additional unpublished applications"). Not legal questions answered by Vane.
- \`verificationWarnings\`: empty unless the verifier flagged citations during this session; the orchestrator populates this.

Inputs:
- Feature profile: {{feature_profile_json}}
- Query plan: {{query_plan_json}}
- Landscape: {{landscape_json}}
- References: {{references_json}}
- Claim chart (or null): {{claim_chart_json}}
`;

const PROMPTS: Record<string, string> = {
  system: SYSTEM,
  featureExtraction: FEATURE_EXTRACTION,
  queryPlanning: QUERY_PLANNING,
  claimAnalysis: CLAIM_ANALYSIS,
  landscapeSynthesis: LANDSCAPE_SYNTHESIS,
  clearanceMemo: CLEARANCE_MEMO,
};

export function loadPrompt(name: string): string {
  const p = PROMPTS[name];
  if (!p) throw new Error(`Unknown priorart prompt: ${name}`);
  return p;
}

export function renderPrompt(name: string, vars: Record<string, string>): string {
  let template = loadPrompt(name);
  for (const [k, v] of Object.entries(vars)) {
    template = template.replaceAll(`{{${k}}}`, v);
  }
  return template;
}
