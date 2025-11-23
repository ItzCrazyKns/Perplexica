import { Intent } from '../../types';

const description = `Use this intent to search through the user's uploaded documents or provided web page links when they ask questions about their personal files or specific URLs.

#### When to use:
1. User explicitly asks about uploaded documents ("tell me about the document I uploaded", "summarize this file").
2. User provides specific URLs/links and asks questions about them ("tell me about example.com", "what's on this page: url.com").
3. User references "my documents", "the file I shared", "this link" when files or URLs are available.

#### When NOT to use:
1. User asks generic questions like "summarize" without providing context or files (later the system will ask what they want summarized).
2. No files have been uploaded and no URLs provided - use web_search or other intents instead.
3. User is asking general questions unrelated to their uploaded content.

#### Example use cases:
1. "Tell me about the PDF I uploaded"
   - Files are uploaded, user wants information from them.
   - Intent: ['private_search'] with skipSearch: false

2. "What's the main point from example.com?"
   - User provided a specific URL to analyze.
   - Intent: ['private_search'] with skipSearch: false

3. "Summarize the research paper I shared"
   - User references a shared document.
   - Intent: ['private_search'] with skipSearch: false

4. "Summarize" (WRONG to use private_search if no files/URLs)
   - No context provided, no files uploaded.
   - Correct: Skip this intent, let the answer agent ask what to summarize

5. "What does my document say about climate change and also search the web for recent updates?"
   - Combine private document search with web search.
   - Intent: ['private_search', 'web_search'] with skipSearch: false

**IMPORTANT**: Only use this intent if files are actually uploaded or URLs are explicitly provided in the query. Check the context for uploaded files before selecting this intent. Always set skipSearch to false when using this intent.

**NOTE**: This intent can be combined with other search intents when the user wants both personal document information and external sources.`;

const privateSearchIntent: Intent = {
  name: 'private_search',
  description,
  enabled: (config) => true,
  requiresSearch: true,
};

export default privateSearchIntent;
