import {
  AdditionalConfig,
  SearchAgentConfig,
  Widget,
  WidgetConfig,
  WidgetOutput,
} from '../types';

class WidgetRegistry {
  private static widgets = new Map<string, Widget>();

  static register(widget: Widget<any>) {
    this.widgets.set(widget.name, widget);
  }

  static get(name: string): Widget | undefined {
    return this.widgets.get(name);
  }

  static getAll(): Widget[] {
    return Array.from(this.widgets.values());
  }

  static getDescriptions(): string {
    return Array.from(this.widgets.values())
      .map((widget) => `${widget.name}: ${widget.description}`)
      .join('\n\n');
  }

  static async execute(
    name: string,
    params: any,
    config: AdditionalConfig,
  ): Promise<WidgetOutput> {
    const widget = this.get(name);

    if (!widget) {
      throw new Error(`Widget with name ${name} not found`);
    }

    return widget.execute(params, config);
  }

  static async executeAll(
    widgets: WidgetConfig[],
    additionalConfig: AdditionalConfig,
  ): Promise<WidgetOutput[]> {
    const results: WidgetOutput[] = [];

    await Promise.all(
      widgets.map(async (widgetConfig) => {
        const output = await this.execute(
          widgetConfig.type,
          widgetConfig.params,
          additionalConfig,
        );
        results.push(output);
      }),
    );

    return results;
  }
}

export default WidgetRegistry;
