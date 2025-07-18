import { webSearchResponsePrompt, webSearchRetrieverPrompt } from './webSearch';
import { localResearchPrompt } from './localResearch';
import { chatPrompt } from './chat';
import { taskBreakdownPrompt } from './taskBreakdown';
import { synthesizerPrompt } from './synthesizer';

const prompts = {
  webSearchResponsePrompt,
  webSearchRetrieverPrompt,
  localResearchPrompt,
  chatPrompt,
  taskBreakdownPrompt,
  synthesizerPrompt,
};

export default prompts;
