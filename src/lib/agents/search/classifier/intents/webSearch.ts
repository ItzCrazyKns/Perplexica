import { Intent } from '../../types';

const description = `
Use this intent to find current information from the web when the user is asking a question or needs up-to-date information that cannot be provided by widgets or other intents. 

#### When to use:
1. Simple user questions about current events, news, weather, or general knowledge that require the latest information and there is no specific better intent to use.
2. When the user explicitly requests information from the web or indicates they want the most recent data (and still there's no other better intent).
3. When no widgets can fully satisfy the user's request for information nor any other specialized search intent applies.

#### Examples use cases:
1. "What is the weather in San Francisco today? ALso tell me some popular events happening there this weekend."
    - In this case, the weather widget can provide the current weather, but for popular events, a web search is needed. So the intent should include a 'web_search' & a 'widget_response'.

2. "Who won the Oscar for Best Picture in 2024?"
    - This is a straightforward question that requires current information from the web.

3. "Give me the latest news on AI regulations."
    - The user is asking for up-to-date news, which necessitates a web search.

**IMPORTANT**: If this intent is given then skip search should be false.
`;

const webSearchIntent: Intent = {
  name: 'web_search',
  description: description,
  requiresSearch: true,
  enabled: (config) => config.sources.includes('web'),
};

export default webSearchIntent;
