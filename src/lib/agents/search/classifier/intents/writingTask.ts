import { Intent } from '../../types';

const writingTaskIntent: Intent = {
  name: 'writing_task',
  description:
    'Use this intent to assist users with writing tasks such as drafting emails, creating documents, or generating content based on their instructions or greetings.',
  requiresSearch: false,
  enabled: (config) => true,
};

export default writingTaskIntent;
