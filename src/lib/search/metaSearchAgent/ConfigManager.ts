import { Config } from './types';
import {
  SearchProviderNames,
  SearchProviderOptions,
} from '../searchProviders/types';
import { loadConfig } from '@/lib/config';

export class ConfigManager {
  constructor(
    private config: Config,
    private language?: string,
  ) {}

  get queryGeneratorPrompt() {
    return this.config.queryGeneratorPrompt;
  }

  get queryGeneratorFewShots() {
    return this.config.queryGeneratorFewShots;
  }

  get responsePrompt() {
    return this.config.responsePrompt;
  }

  get activeEngines() {
    return this.config.activeEngines;
  }

  getSearchOptionsFor(
    providerName: SearchProviderNames,
  ): SearchProviderOptions {
    const config = loadConfig();

    // 1. Base options from config.toml [SEARCH] section
    const baseOptions = {
      count: config.SEARCH.COUNT,
      language: this.language || config.SEARCH.LANGUAGE,
    };

    // 2. Provider-specific options from config.toml [SEARCH.PROVIDERS] section
    const providerSpecificOptions =
      config.SEARCH?.PROVIDERS?.[providerName] || {};

    // 3. Focus-mode specific options from the handler config (e.g., activeEngines)
    // TODO: only for searxng
    const focusModeOptions = {
      engines: this.config.activeEngines,
    };

    // Merge all options. Specific options override base options.
    return { ...baseOptions, ...focusModeOptions, ...providerSpecificOptions };
  }

  get searchWeb() {
    return this.config.searchWeb;
  }

  get rerank() {
    return this.config.rerank;
  }

  get rerankThreshold() {
    return this.config.rerankThreshold ?? 0.3;
  }
}
