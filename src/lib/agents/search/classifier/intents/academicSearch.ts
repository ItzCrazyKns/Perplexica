import { Intent } from '../../types';

const academicSearchIntent: Intent = {
  name: 'academic_search',
  description:
    'Use this intent to find scholarly articles, research papers, and academic resources when the user is seeking credible and authoritative information on a specific topic.',
  requiresSearch: true,
  enabled: (config) => config.sources.includes('academic'),
};

export default academicSearchIntent;
