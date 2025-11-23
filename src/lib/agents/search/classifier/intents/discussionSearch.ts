import { Intent } from '../../types';

const description = `Use this intent to search through discussion forums, community boards, and social platforms (Reddit, forums, etc.) when the user explicitly wants opinions, personal experiences, community discussions, or crowd-sourced information.

#### When to use:
1. User explicitly mentions: Reddit, forums, discussion boards, community opinions, "what do people think", "user experiences".
2. User is asking for opinions, reviews, or personal experiences about a product, service, or topic.
3. User wants to know what communities or people are saying about something.

#### When NOT to use:
1. General questions that don't specifically ask for opinions or discussions - use 'web_search' instead.
2. User wants factual information or official sources.
3. Casual queries about facts, news, or current events without requesting community input.

#### Example use cases:
1. "What do people on Reddit think about the new iPhone?"
   - User explicitly wants Reddit/community opinions.
   - Intent: ['discussions_search'] with skipSearch: false

2. "User experiences with Tesla Model 3"
   - User is asking for personal experiences from users.
   - Intent: ['discussions_search'] with skipSearch: false

3. "Best gaming laptop according to forums"
   - User wants forum/community recommendations.
   - Intent: ['discussions_search'] with skipSearch: false

4. "What are people saying about the new AI regulations?"
   - User wants community discussions/opinions.
   - Intent: ['discussions_search', 'web_search'] with skipSearch: false

5. "Reviews and user opinions on the Framework laptop"
   - Combines user opinions with general reviews.
   - Intent: ['discussions_search', 'web_search'] with skipSearch: false

6. "What's the price of iPhone 15?" (WRONG to use discussions_search)
   - This is a factual question, not asking for opinions.
   - Correct intent: ['web_search'] with skipSearch: false

7. "Explain how OAuth works" (WRONG to use discussions_search)
   - This is asking for information, not community opinions.
   - Correct intent: ['web_search'] with skipSearch: false

**IMPORTANT**: This intent can be combined with 'web_search' to provide both community discussions and official/factual information. Always set skipSearch to false when using this intent.

**NOTE**: This intent is only available if discussion search sources are enabled in the configuration.`;

const discussionSearchIntent: Intent = {
  name: 'discussions_search',
  description,
  requiresSearch: true,
  enabled: (config) => config.sources.includes('discussions'),
};

export default discussionSearchIntent;
