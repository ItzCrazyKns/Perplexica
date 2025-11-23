import { Intent } from '../../types';

const description = `Use this intent for simple writing or greeting tasks that do not require any external information or facts. This is ONLY for greetings and straightforward creative writing that needs no factual verification.

#### When to use:
1. User greetings or simple social interactions (hello, hi, thanks, goodbye).
2. Creative writing tasks that require NO factual information (poems, birthday messages, thank you notes).
3. Simple drafting tasks where the user provides all necessary information.

#### When NOT to use:
1. ANY question that starts with "what", "how", "why", "when", "where", "who" - these need web_search.
2. Requests for explanations, definitions, or information about anything.
3. Code-related questions or technical help - these need web_search.
4. Writing tasks that require facts, data, or current information.
5. When you're uncertain about any information needed - default to web_search.

#### Example use cases:
1. "Hello" or "Hi there"
   - Simple greeting, no information needed.
   - Intent: ['writing_task'] with skipSearch: true

2. "Write me a birthday message for my friend"
   - Creative writing, no facts needed.
   - Intent: ['writing_task'] with skipSearch: true

3. "Draft a thank you email for a job interview"
   - Simple writing task, no external information required.
   - Intent: ['writing_task'] with skipSearch: true

4. "What is React?" (WRONG to use writing_task)
   - This is a QUESTION asking for information.
   - Correct intent: ['web_search'] with skipSearch: false

5. "How do I fix this error in Python?" (WRONG to use writing_task)
   - This is asking for technical help.
   - Correct intent: ['web_search'] with skipSearch: false

6. "Write an email about the latest AI developments" (WRONG to use writing_task alone)
   - This requires current information about AI developments.
   - Correct intent: ['web_search'] with skipSearch: false

**CRITICAL RULE**: When in doubt, DO NOT use this intent. Default to web_search. This intent should be rare - only use it for greetings and purely creative writing tasks that need absolutely no facts or information.

**IMPORTANT**: If this intent is used alone, skipSearch should be true. Never combine this with other search intents unless you're absolutely certain both are needed.`;

const writingTaskIntent: Intent = {
  name: 'writing_task',
  description,
  requiresSearch: false,
  enabled: (config) => true,
};

export default writingTaskIntent;
