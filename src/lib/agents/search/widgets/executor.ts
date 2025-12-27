import { Widget, WidgetInput, WidgetOutput } from '../types';

class WidgetExecutor {
  static widgets = new Map<string, Widget>();

  static register(widget: Widget) {
    this.widgets.set(widget.type, widget);
  }

  static getWidget(type: string): Widget | undefined {
    return this.widgets.get(type);
  }

  static async executeAll(input: WidgetInput): Promise<WidgetOutput[]> {
    const results: WidgetOutput[] = [];

    await Promise.all(
      Array.from(this.widgets.values()).map(async (widget) => {
        try {
          if (widget.shouldExecute(input.classification)) {
            const output = await widget.execute(input);
            if (output) {
              results.push(output);
            }
          }
        } catch (e) {
          console.log(`Error executing widget ${widget.type}:`, e);
        }
      }),
    );

    return results;
  }
}

export default WidgetExecutor;
