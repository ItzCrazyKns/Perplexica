import { Intent, SearchAgentConfig, SearchSources } from '../../types';

class IntentRegistry {
  private static intents = new Map<string, Intent>();

  static register(intent: Intent) {
    this.intents.set(intent.name, intent);
  }

  static get(name: string): Intent | undefined {
    return this.intents.get(name);
  }

  static getAvailableIntents(config: { sources: SearchSources[] }): Intent[] {
    return Array.from(
      this.intents.values().filter((intent) => intent.enabled(config)),
    );
  }

  static getDescriptions(config: { sources: SearchSources[] }): string {
    const availableintents = this.getAvailableIntents(config);

    return availableintents
      .map(
        (intent) => `-------\n\n###${intent.name}: ${intent.description}\n\n`,
      )
      .join('\n\n');
  }
}

export default IntentRegistry;
