import { Config } from './types';

export class ConfigManager {
  constructor(private config: Config) {}

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
