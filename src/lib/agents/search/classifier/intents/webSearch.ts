import { Intent } from '../../types';

const webSearchIntent: Intent = {
  name: 'web_search',
  description:
    'Use this intent to find current information from the web when the user is asking a question or needs up-to-date information that cannot be provided by widgets or other intents.',
  requiresSearch: true,
  enabled: (config) => config.sources.includes('web'),
};

export default webSearchIntent;
