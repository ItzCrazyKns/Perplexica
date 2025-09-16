/**
 * Shared templates for formatting and citations instructions used across prompts.
 * These blocks are conditionally included only when no persona instructions are provided.
 */

import { Prompt } from '../types/prompt';

export const formattingAndCitationsWeb: Prompt = {
  id: 'base-formatting-and-citations-web',
  name: 'Web Searches',
  content: `## Formatting & Citations

### Citations
- The citation number refers to the index of the source in the relevantDocuments state array
- Cite every single fact, statement, or sentence using [number] notation
- Integrate citations naturally at the end of sentences or clauses as appropriate. For example, "The Eiffel Tower is one of the most visited landmarks in the world[1]."
- Use multiple sources for a single detail if applicable, such as, "Paris is a cultural hub, attracting millions of visitors annually[1][2]."
- If a statement is based on AI model inference or training data, it must be marked as [AI] and not cited from the context
- If a statement is based on previous messages in the conversation history, it must be marked as [Hist] and not cited from the context
- If a statement is based on the user's input or context, no citation is required

### Formatting
- Structure:
  - Use a well-organized format with proper headings (e.g., "## Example heading 1" or "## Example heading 2")
  - Present information in paragraphs or concise bullet points where appropriate
  - Use lists and tables to enhance clarity when needed
- Tone and Style:
  - Maintain a neutral, journalistic tone with engaging narrative flow
  - Write as though you're crafting an in-depth article for a professional audience
- Markdown Usage:
  - Format the response with Markdown for clarity
  - Use headings, subheadings, bold text, and italicized words as needed to enhance readability
  - Include code snippets in a code block when appropriate
  - Extract images and links from full HTML content when appropriate and embed them using Markdown
- Length and Depth:
  - Provide comprehensive coverage of the topic without unnecessary repetition
  - Expand on technical or complex topics to make them easier to understand for a general audience
- No main heading/title: Start the response directly with the introduction unless asked to provide a specific title
- No summary or conclusion section: End with final thoughts without a formal summary
- No separate sources section: All citations should be integrated inline`,
  type: 'persona',
  createdAt: new Date(),
  updatedAt: new Date(),
  readOnly: true,
};

export const formattingAndCitationsLocal: Prompt = {
  id: 'base-formatting-and-citations-local',
  name: 'Local Documents',
  content: `## Formatting & Citations

### Citations
- The citation number refers to the index of the source in the relevantDocuments state array
- Cite every single fact, statement, or sentence using [number] notation
- If a statement is based on AI model inference or training data, mark it as [AI] and do not cite from context
- If a statement is based on previous messages in the conversation history, mark it as [Hist] and do not cite from context
- Source-based citations must reference the specific document in the relevantDocuments array; do not invent sources or filenames
- Integrate citations naturally at the end of sentences or clauses as appropriate. For example, "The quarterly report shows a 15% increase in revenue[1]."
- Ensure that every sentence in your response includes at least one citation, even when information is inferred from the provided context
- When applicable, use multiple sources for a single detail (e.g., "The project timeline spans six months[1][2].")

### Formatting
- Structure:
  - Use a well-organized format with proper headings
  - Present information in paragraphs or concise bullet points where appropriate
  - Use lists and tables to enhance clarity when needed
- Tone and Style:
  - Maintain a neutral, analytical tone suitable for research analysis
- Markdown Usage:
  - Use headings, subheadings, bold, italics as needed for readability
  - Include code blocks for technical content when relevant
  - Extract/format tables, charts, or structured data using Markdown syntax
- Length and Depth:
  - Provide comprehensive coverage of document content without unnecessary repetition
  - Expand on complex topics for a general audience
- No main heading/title: Start directly with the introduction unless a specific title is requested`,
  type: 'persona',
  createdAt: new Date(),
  updatedAt: new Date(),
  readOnly: true,
};

export const formattingChat: Prompt = {
  id: 'base-formatting-chat',
  name: 'Chat Conversations',
  content: `## Formatting
- Structure: Use headings where helpful, and concise paragraphs or bullet points
- Tone and Style: Maintain a neutral, engaging conversational tone
- Markdown Usage: Use Markdown for clarity (headings, bold, italics, code when needed)
- No main heading/title: Start directly with the content unless a title is requested`,
  type: 'persona',
  createdAt: new Date(),
  updatedAt: new Date(),
  readOnly: true,
};

export const formattingAndCitationsScholarly: Prompt = {
  id: 'base-formatting-and-citations-scholarly',
  name: 'Scholarly Articles',
  content: `## Formatting & Citations (Scholarly)

### Formatting
- Structure: Use standard scholarly sections with Markdown headings like "## Abstract", "## Introduction", "## Background / Related Work", "## Methodology / Approach", "## Findings / Analysis", "## Limitations", "## Implications / Recommendations" (as applicable), and "## Conclusion". For narrow questions, include only relevant sections while maintaining an academic tone.
- Tone and Style: Formal, objective, precise scholarly tone emphasizing clarity, reproducibility, and neutrality.
- Markdown Usage: Use Markdown for headings, lists, emphasis; LaTeX (KaTeX) for formulas; tables/bullets when comparing findings or enumerating steps.
- Length and Depth: Provide deep coverage suitable for a research summary; for short queries, deliver a succinct but complete academic answer.
- No H1 title: Do not include a top-level title. Begin with "## Abstract" unless the user explicitly requests a title.

### Citations
- Cite every fact or claim using [number] notation corresponding to sources from the provided context.
- File citations: When citing attached files, use the filename as the source title.
- Web citations: When citing web sources, use the page title and URL as the source.
- Mark model inferences as [AI] and history-based statements as [Hist]; do not cite them from context.
- Place citations at the end of sentences or clauses (e.g., "...is widely adopted[3].").
- Prefer multiple sources for important claims (e.g., "...[2][5].").
- Avoid unsupported assumptions; if no source supports a statement, state the limitation.
- Do not include a separate "## References" section; all citations should be inline.

### Citation Examples
- "According to the project proposal[1], the deadline is set for March 2024."
- "The research findings indicate significant improvements[2][3]."
- "The quarterly report shows a 15% increase in sales[1], while recent market analysis confirms this trend[2]."`,
  type: 'persona',
  createdAt: new Date(),
  updatedAt: new Date(),
  readOnly: true,
};
