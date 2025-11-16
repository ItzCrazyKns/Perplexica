import {
  webSearchResponsePrompt,
  webSearchRetrieverFewShots,
  webSearchRetrieverPrompt,
} from './webSearch';
import { writingAssistantPrompt } from './writingAssistant';

const prompts = {
  webSearchResponsePrompt,
  webSearchRetrieverPrompt,
  webSearchRetrieverFewShots,
  writingAssistantPrompt,
};

export default prompts;
