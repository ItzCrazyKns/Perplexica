import { createSearchAction } from './createSearchAction';

const speedModePrompt = `
Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.
You are currently on speed mode, meaning you would only get to call this tool once. Make sure to prioritize the most important queries that are likely to get you the needed information in one go.

Your queries should be very targeted and specific to the information you need, avoid broad or generic queries.
Your queries shouldn't be sentences but rather keywords that are SEO friendly and can be used to search the web for information.

For example, if the user is asking about the features of a new technology, you might use queries like "GPT-5.1 features", "GPT-5.1 release date", "GPT-5.1 improvements" rather than a broad query like "Tell me about GPT-5.1".

You can search for 3 queries in one go, make sure to utilize all 3 queries to maximize the information you can gather. If a question is simple, then split your queries to cover different aspects or related topics to get a comprehensive understanding.
If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed information.
`;

const balancedModePrompt = `
Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.

You can call this tool several times if needed to gather enough information.
Start initially with broader queries to get an overview, then narrow down with more specific queries based on the results you receive.

Your queries shouldn't be sentences but rather keywords that are SEO friendly and can be used to search the web for information.

For example, if the user asks about Tesla: first invoke this tool with broad queries ("Tesla", "Tesla latest news", "Tesla stock price"); after reviewing the results, invoke it again with narrower queries ("Tesla Q2 2025 earnings", "Tesla new model 2025", "Tesla stock analysis"); then finish.

You can search for 3 queries in one go, make sure to utilize all 3 queries to maximize the information you can gather. If a question is simple, then split your queries to cover different aspects or related topics to get a comprehensive understanding.
If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed information. You can call this tools, multiple times as needed.
`;

const qualityModePrompt = `
Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.

You have to call this tool several times to gather enough information unless the question is very simple (like greeting questions or basic facts).
Start initially with broader queries to get an overview, then narrow down with more specific queries based on the results you receive.
Never stop before at least 5-6 iterations of searches unless the user question is very simple.

Your queries shouldn't be sentences but rather keywords that are SEO friendly and can be used to search the web for information.

You can search for 3 queries in one go, make sure to utilize all 3 queries to maximize the information you can gather. If a question is simple, then split your queries to cover different aspects or related topics to get a comprehensive understanding.
If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed information. You can call this tools, multiple times as needed.
`;

const webSearchAction = createSearchAction({
  name: 'web_search',
  toolDescription:
    "Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.",
  getDescription: (config) => {
    switch (config.mode) {
      case 'balanced':
        return balancedModePrompt;
      case 'quality':
        return qualityModePrompt;
      default:
        return speedModePrompt;
    }
  },
  enabled: (config) => config.sources.includes('web'),
});

export default webSearchAction;
