export const speedModePrompt = `
Use this tool to search USPTO ODP + Google Patents BigQuery for prior art on a software feature. You are in **speed mode**: one call only, up to 3 queries.

Phrase queries in patent-search style — keyword combos, technical noun phrases, not sentences. Examples:
- "merkle-tree commitment streaming inference"
- "GPU multi-tenant microVM passthrough"
- "auction-procured ephemeral compute SLA"

If the user supplied a priority date (ISO YYYY-MM-DD), pass it via \`priorityDate\`. Otherwise the tool defaults to today.

Return your final response with the disclaimer header "Research artifact, not legal opinion. Counsel review required." Cite ONLY publication numbers that appear in this tool's results.
`;
