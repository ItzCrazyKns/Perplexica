import { Intent } from '../../types';

const discussionSearchIntent: Intent = {
  name: 'discussion_search',
  description:
    'Use this intent to search through discussion forums, community boards, or social media platforms when the user is looking for opinions, experiences, or community-driven information on a specific topic.',
  requiresSearch: true,
  enabled: (config) => config.sources.includes('discussions'),
};

export default discussionSearchIntent;
