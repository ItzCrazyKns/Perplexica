import { Tool, ToolCall } from '@/lib/models/types';
import {
  ActionOutput,
  AdditionalConfig,
  ClassifierOutput,
  ResearchAction,
  SearchAgentConfig,
  SearchSources,
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
    fileIds: string[];
    mode: SearchAgentConfig['mode'];
    sources: SearchSources[];
    allowWrites?: boolean;
  }): ResearchAction[] {
    return Array.from(
      this.actions.values().filter((action) => action.enabled(config)),
    );
  }

  static getAvailableActionTools(config: {
    classification: ClassifierOutput;
    fileIds: string[];
    mode: SearchAgentConfig['mode'];
    sources: SearchSources[];
    allowWrites?: boolean;
  }): Tool[] {
    const availableActions = this.getAvailableActions(config);

    return availableActions.map((action) => ({
      name: action.name,
      description: action.getToolDescription({ mode: config.mode }),
      schema: action.schema,
    }));
  }

  static getAvailableActionsDescriptions(config: {
    classification: ClassifierOutput;
    fileIds: string[];
    mode: SearchAgentConfig['mode'];
    sources: SearchSources[];
    allowWrites?: boolean;
  }): string {
    const availableActions = this.getAvailableActions(config);

    return availableActions
      .map(
        (action) =>
          `<tool name="${action.name}">\n${action.getDescription({ mode: config.mode })}\n</tool>`,
      )
      .join('\n\n');
  }

  static async execute(
    name: string,
    params: any,
    additionalConfig: AdditionalConfig & {
      researchBlockId: string;
      fileIds: string[];
      mode: SearchAgentConfig['mode'];
    },
  ) {
    const action = this.actions.get(name);

    if (!action) {
      throw new Error(`Action with name ${name} not found`);
    }

    return action.execute(params, additionalConfig);
  }

  static async executeAll(
    actions: ToolCall[],
    additionalConfig: AdditionalConfig & {
      researchBlockId: string;
      fileIds: string[];
      mode: SearchAgentConfig['mode'];
    },
  ): Promise<ActionOutput[]> {
    // Staged writes (stagesWrite actions) must land in the same order as
    // the model's tool calls — appends to the same page would otherwise
    // be reordered in the confirmation batch — so they run sequentially.
    // Every other action is independent and runs concurrently: serializing
    // search/read calls would add latency equal to the sum of their
    // remote round trips. Caller code still pairs results with tool calls
    // by index, so results are collected into a pre-sized array.
    const results: ActionOutput[] = new Array(actions.length);
    const stagedWrites: number[] = [];
    const independent: number[] = [];

    actions.forEach((actionConfig, index) => {
      const action = this.actions.get(actionConfig.name);
      if (action?.stagesWrite) {
        stagedWrites.push(index);
      } else {
        independent.push(index);
      }
    });

    await Promise.all(
      independent.map(async (index) => {
        results[index] = await this.execute(
          actions[index].name,
          actions[index].arguments,
          additionalConfig,
        );
      }),
    );

    for (const index of stagedWrites) {
      results[index] = await this.execute(
        actions[index].name,
        actions[index].arguments,
        additionalConfig,
      );
    }

    return results;
  }
}

export default ActionRegistry;
