import configManager from './index';
import { ConfigModelProvider } from './types';

export const getConfiguredModelProviders = (): ConfigModelProvider[] => {
  return configManager.getConfig('modelProviders', []);
};

export const getConfiguredModelProviderById = (
  id: string,
): ConfigModelProvider | undefined => {
  return getConfiguredModelProviders().find((p) => p.id === id) ?? undefined;
};

export const getSearxngURL = () =>
  configManager.getConfig('search.searxngURL', '');

export const getCrwURL = () =>
  configManager.getConfig('search.crwURL', 'https://fastcrw.com/api');

export const getCrwApiKey = () => configManager.getConfig('search.crwApiKey', '');

export const getSearchProvider = () =>
  configManager.getConfig('search.searchProvider', 'searxng');
