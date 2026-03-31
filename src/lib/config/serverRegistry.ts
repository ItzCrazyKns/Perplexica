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

export const getTavilyAPIKey = (): string =>
  configManager.getConfig('search.tavilyAPIKey', '');

export const getSearchProvider = (): 'searxng' | 'tavily' =>
  configManager.getConfig('search.searchProvider', 'searxng');
