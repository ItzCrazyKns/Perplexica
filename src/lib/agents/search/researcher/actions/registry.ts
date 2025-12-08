import { Tool, ToolCall } from '@/lib/models/types';
import {
  ActionOutput,
  AdditionalConfig,
  ClassifierOutput,
  ResearchAction,
} from '../../types';

class ActionRegistry {
  private static actions: Map<string, ResearchAction> = new Map();

  static register(action: ResearchAction<any>) {
    this.actions.set(action.name, action);
  }

  static get(name: string): ResearchAction | undefined {
    return this.actions.get(name);
  }

  static getAvailableActions(config: {
    classification: ClassifierOutput;
  }): ResearchAction[] {
    return Array.from(
      this.actions.values().filter((action) => action.enabled(config)),
    );
  }

  static getAvailableActionTools(config: {
    classification: ClassifierOutput;
  }): Tool[] {
    const availableActions = this.getAvailableActions(config);

    return availableActions.map((action) => ({
      name: action.name,
      description: action.description,
      schema: action.schema,
    }));
  }

  static getAvailableActionsDescriptions(config: {
    classification: ClassifierOutput;
  }): string {
    const availableActions = this.getAvailableActions(config);

    return availableActions
      .map((action) => `------------\n##${action.name}\n${action.description}`)
      .join('\n\n');
  }

  static async execute(
    name: string,
    params: any,
    additionalConfig: AdditionalConfig & { researchBlockId: string },
  ) {
    const action = this.actions.get(name);

    if (!action) {
      throw new Error(`Action with name ${name} not found`);
    }

    return action.execute(params, additionalConfig);
  }

  static async executeAll(
    actions: ToolCall[],
    additionalConfig: AdditionalConfig & { researchBlockId: string },
  ): Promise<ActionOutput[]> {
    const results: ActionOutput[] = [];

    await Promise.all(
      actions.map(async (actionConfig) => {
        const output = await this.execute(
          actionConfig.name,
          actionConfig.arguments,
          additionalConfig,
        );
        results.push(output);
      }),
    );

    return results;
  }
}

export default ActionRegistry;
