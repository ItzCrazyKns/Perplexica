import { Intent } from '../../types';

const description = `Use this intent to search for scholarly articles, research papers, scientific studies, and academic resources when the user explicitly requests credible, peer-reviewed, or authoritative information from academic sources.

#### When to use:
1. User explicitly mentions academic keywords: research papers, scientific studies, scholarly articles, peer-reviewed, journal articles.
2. User asks for scientific evidence or academic research on a topic.
3. User needs authoritative, citation-worthy sources for research or academic purposes.

#### When NOT to use:
1. General questions that don't specifically request academic sources - use 'web_search' instead.
2. User just wants general information without specifying academic sources.
3. Casual queries about facts or current events.

#### Example use cases:
1. "Find scientific papers on climate change effects"
   - User explicitly wants scientific papers.
   - Intent: ['academic_search'] with skipSearch: false

2. "What does the research say about meditation benefits?"
   - User is asking for research-based information.
   - Intent: ['academic_search', 'web_search'] with skipSearch: false

3. "Show me peer-reviewed articles on CRISPR technology"
   - User specifically wants peer-reviewed academic content.
   - Intent: ['academic_search'] with skipSearch: false

4. "I need scholarly sources about renewable energy for my thesis"
   - User explicitly needs scholarly/academic sources.
   - Intent: ['academic_search'] with skipSearch: false

5. "Explain quantum computing" (WRONG to use academic_search alone)
   - This is a general question, not specifically requesting academic papers.
   - Correct intent: ['web_search'] with skipSearch: false
   - Could combine: ['web_search', 'academic_search'] if you want both general and academic sources

6. "What's the latest study on sleep patterns?"
   - User mentions "study" - combine academic and web search for comprehensive results.
   - Intent: ['academic_search', 'web_search'] with skipSearch: false

**IMPORTANT**: This intent can be combined with 'web_search' to provide both academic papers and general web information. Always set skipSearch to false when using this intent.

**NOTE**: This intent is only available if academic search sources are enabled in the configuration.`;

const academicSearchIntent: Intent = {
  name: 'academic_search',
  description,
  requiresSearch: true,
  enabled: (config) => config.sources.includes('academic'),
};

export default academicSearchIntent;
