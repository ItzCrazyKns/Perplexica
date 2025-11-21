import doneAction from './done';
import ActionRegistry from './registry';
import webSearchAction from './webSearch';

ActionRegistry.register(webSearchAction);
ActionRegistry.register(doneAction);

export { ActionRegistry };
