import academicSearchAction from './search/academicSearch';
import doneAction from './done';
import planAction from './plan';
import priorArtSearchAction from './priorartSearch';
import ActionRegistry from './registry';
import scrapeURLAction from './scrapeURL';
import socialSearchAction from './search/socialSearch';
import uploadsSearchAction from './uploadsSearch';
import webSearchAction from './search/webSearch';

ActionRegistry.register(webSearchAction);
ActionRegistry.register(doneAction);
ActionRegistry.register(planAction);
ActionRegistry.register(scrapeURLAction);
ActionRegistry.register(uploadsSearchAction);
ActionRegistry.register(academicSearchAction);
ActionRegistry.register(socialSearchAction);
ActionRegistry.register(priorArtSearchAction);

export { ActionRegistry };
