import academicSearchIntent from './academicSearch';
import discussionSearchIntent from './discussionSearch';
import IntentRegistry from './registry';
import webSearchIntent from './webSearch';
import widgetResponseIntent from './widgetResponse';
import writingTaskIntent from './writingTask';

IntentRegistry.register(webSearchIntent);
IntentRegistry.register(academicSearchIntent);
IntentRegistry.register(discussionSearchIntent);
IntentRegistry.register(widgetResponseIntent);
IntentRegistry.register(writingTaskIntent);

export { IntentRegistry };
