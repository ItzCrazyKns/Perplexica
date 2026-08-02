import { createSearchAction } from './createSearchAction';

const academicSearchDescription = `
Use this tool to perform academic searches for scholarly articles, papers, and research studies relevant to the user's query. Provide a list of concise search queries that will help gather comprehensive academic information on the topic at hand.
You can provide up to 3 queries at a time. Make sure the queries are specific and relevant to the user's needs.

For example, if the user is interested in recent advancements in renewable energy, your queries could be:
1. "Recent advancements in renewable energy 2024"
2. "Cutting-edge research on solar power technologies"
3. "Innovations in wind energy systems"

If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed academic information.
`;

const academicSearchAction = createSearchAction({
  name: 'academic_search',
  toolDescription:
    "Use this tool to perform academic searches for scholarly articles, papers, and research studies relevant to the user's query. Provide a list of concise search queries that will help gather comprehensive academic information on the topic at hand.",
  getDescription: () => academicSearchDescription,
  enabled: (config) =>
    config.sources.includes('academic') &&
    config.classification.classification.academicSearch === true,
  engines: ['arxiv', 'google scholar', 'pubmed'],
});

export default academicSearchAction;
