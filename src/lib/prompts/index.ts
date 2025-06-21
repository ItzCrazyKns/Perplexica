import { webSearchResponsePrompt, webSearchRetrieverPrompt } from './webSearch';
import { localResearchPrompt } from './localResearch';
import { chatPrompt } from './chat';
import { taskBreakdownPrompt } from './taskBreakdown';

const prompts = {
  webSearchResponsePrompt,
  webSearchRetrieverPrompt,
  localResearchPrompt,
  chatPrompt,
  taskBreakdownPrompt,
};

export default prompts;
