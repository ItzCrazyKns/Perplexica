// Reviewer prompt for coverage and consistency
export const reviewerPrompt = `
Review the draft for coverage and contradictions. Identify low-confidence sections.
Return JSON: {"issues": string[], "lowConfidenceSections": string[]}
Keep it brief.`;
