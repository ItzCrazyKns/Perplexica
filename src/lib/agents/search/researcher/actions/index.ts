import academicSearchAction from './search/academicSearch';
import doneAction from './done';
import planAction from './plan';
import ActionRegistry from './registry';
import scrapeURLAction from './scrapeURL';
import socialSearchAction from './search/socialSearch';
import uploadsSearchAction from './uploadsSearch';
import webSearchAction from './search/webSearch';
import {
  notionSearchAction,
  notionGetPageAction,
  notionQueryDatabaseAction,
  notionAppendContentAction,
  notionUpdatePageAction,
  notionCreatePageAction,
} from './notion';

ActionRegistry.register(webSearchAction);
ActionRegistry.register(doneAction);
ActionRegistry.register(planAction);
ActionRegistry.register(scrapeURLAction);
ActionRegistry.register(uploadsSearchAction);
ActionRegistry.register(academicSearchAction);
ActionRegistry.register(socialSearchAction);
ActionRegistry.register(notionSearchAction);
ActionRegistry.register(notionGetPageAction);
ActionRegistry.register(notionQueryDatabaseAction);
ActionRegistry.register(notionAppendContentAction);
ActionRegistry.register(notionUpdatePageAction);
ActionRegistry.register(notionCreatePageAction);

export { ActionRegistry };
