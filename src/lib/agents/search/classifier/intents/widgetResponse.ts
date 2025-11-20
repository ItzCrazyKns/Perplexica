import { Intent } from '../../types';

const widgetResponseIntent: Intent = {
  name: 'widget_response',
  description:
    'Use this intent to respond to user queries using available widgets when the required information can be obtained from them.',
  requiresSearch: false,
  enabled: (config) => true,
};

export default widgetResponseIntent;
