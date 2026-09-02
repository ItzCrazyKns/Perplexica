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

export const getSearchProvider = (): 'searxng' | 'youcom' => {
  const provider = configManager.getConfig('search.provider', 'searxng');
  return provider === 'youcom' ? 'youcom' : 'searxng';
};

export const getYoucomApiKey = (): string => {
  return (
    configManager.getConfig('search.youcomApiKey', '') ||
    process.env.YDC_API_KEY ||
    ''
  );
};
