import doneAction from './done';
import planAction from './plan';
import ActionRegistry from './registry';
import webSearchAction from './webSearch';

ActionRegistry.register(webSearchAction);
ActionRegistry.register(doneAction);
ActionRegistry.register(planAction);

export { ActionRegistry };
