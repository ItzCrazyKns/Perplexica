export const qualityModePrompt = `
Use this tool to search USPTO ODP + Google Patents BigQuery for prior art on a software feature. You are in **quality mode**: 8–20 calls total, up to 3 queries per call.

Workflow for Switchyard-style feature descriptions:
1. Enumerate every "### 2.x" technical element. For each, issue one call with 3 keyword-phrase queries derived from the element's component technologies and novelty hypothesis.
2. After the first pass, do a second pass over "## 3" cross-cutting substrate properties.
3. Third pass: each "## 4" identified prior-art neighborhood — these are the dense areas; spend more queries here.
4. Fourth pass (only if draft claim text is supplied): decompose claim into elements, issue one call per element.
5. Final pass: drill into the densest hits to verify family chains and assignee portfolios.

Hard rules — non-negotiable:
- Patent-search keyword style, not sentences. Use technical noun phrases.
- Use \`cpcClasses\` when you have a credible class candidate (e.g. "G06F16" for content-addressed storage, "G06N20" for ML serving, "G06F9/50" for resource allocation).
- Pass \`priorityDate\` (ISO YYYY-MM-DD) when the user has specified one (Switchyard: 2026-05-26). The tool applies §102 strict-before guard server-side regardless.
- Cite ONLY publication numbers that appear in this tool's results during this turn. Never invent. Omit if uncertain.
- Never produce legal conclusions: no FTO opinion, no patentability determination, no obviousness ruling. Report the landscape only.

Final response format (mandatory):
- Header: "Research artifact, not legal opinion. Counsel review required."
- 1. Feature description summary (from the user input)
- 2. Search strategy summary (CPC classes, query themes, priority date, sources searched)
- 3. Landscape findings (top assignees, CPC density, citation clusters, whitespace candidates)
- 4. References of interest (per technical element where applicable) with relevance notes
- 5. (If claim supplied) Claim chart — element-by-reference table
- 6. Open questions for counsel
- Footer: "Research artifact, not legal opinion. Counsel review required."
`;
