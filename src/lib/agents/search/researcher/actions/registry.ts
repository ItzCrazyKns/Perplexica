import { Tool, ToolCall } from '@/lib/models/types';
import {
  ActionContext,
  ActionOutput,
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

  static getAvailableActions(config: {
    classification: ClassifierOutput;
    fileIds: string[];
    mode: SearchAgentConfig['mode'];
    sources: SearchSources[];
  }): ResearchAction[] {
    return Array.from(this.actions.values()).filter((action) =>
      action.enabled(config),
    );
  }

  static getAvailableActionTools(config: {
    classification: ClassifierOutput;
    fileIds: string[];
    mode: SearchAgentConfig['mode'];
    sources: SearchSources[];
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
  }): string {
    const availableActions = this.getAvailableActions(config);

    return availableActions
      .map(
        (action) =>
          `<tool name="${action.name}">\n${action.getDescription({ mode: config.mode })}\n</tool>`,
      )
      .join('\n\n');
  }

  private static async execute(
    name: string,
    params: any,
    additionalConfig: ActionContext,
  ): Promise<ActionOutput> {
    const action = this.actions.get(name);

    if (!action) {
      throw new Error(`Action with name ${name} not found`);
    }

    /* Arguments are raw LLM JSON: validate before the action indexes
       into them, or a wrong shape throws deep inside the tool. */
    const parsed = action.schema.safeParse(params);

    if (!parsed.success) {
      return {
        type: 'search_results',
        results: [
          {
            content: `Tool ${name} received invalid arguments: ${parsed.error.message}. Retry with arguments matching the schema.`,
            metadata: {},
          },
        ],
      };
    }

    return action.execute(parsed.data, additionalConfig);
  }

  static async executeAll(
    actions: ToolCall[],
    additionalConfig: ActionContext,
  ): Promise<ActionOutput[]> {
    /* Promise.all preserves input order, which the caller relies on to
       pair each result with its tool_call_id. One failing tool must
       not abort the whole research loop, so failures come back as
       content the model can react to. */
    return Promise.all(
      actions.map(async (actionConfig) => {
        try {
          return await this.execute(
            actionConfig.name,
            actionConfig.arguments,
            additionalConfig,
          );
        } catch (err: any) {
          console.error(`Action ${actionConfig.name} failed:`, err);

          return {
            type: 'search_results',
            results: [
              {
                content: `Tool ${actionConfig.name} failed: ${err?.message ?? String(err)}`,
                metadata: {},
              },
            ],
          } satisfies ActionOutput;
        }
      }),
    );
  }
}

export default ActionRegistry;
