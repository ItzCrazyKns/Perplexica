import { BaseOutputParser } from '@langchain/core/output_parsers';

interface LineListOutputParserArgs {
  key?: string;
}

class LineListOutputParser extends BaseOutputParser<string[]> {
  private key = 'questions';

  constructor(args?: LineListOutputParserArgs) {
    super();
    this.key = args?.key ?? this.key;
  }

  static lc_name() {
    return 'LineListOutputParser';
  }

  lc_namespace = ['langchain', 'output_parsers', 'line_list_output_parser'];

  async parse(text: string): Promise<string[]> {
    text = text.trim() || '';

    // First, remove all <think>...</think> blocks to avoid parsing tags inside thinking content
    // This might be a little aggressive. Prompt massaging might be all we need, but this is a guarantee and should rarely mess anything up.
    text = this.removeThinkingBlocks(text);

    const regex = /^(\s*(-|\*|\d+\.\s|\d+\)\s|\u2022)\s*)+/;
    const startKeyIndex = text.indexOf(`<${this.key}>`);
    const endKeyIndex = text.indexOf(`</${this.key}>`);

    if (startKeyIndex === -1 || endKeyIndex === -1) {
      return [];
    }

    const questionsStartIndex =
      startKeyIndex === -1 ? 0 : startKeyIndex + `<${this.key}>`.length;
    const questionsEndIndex = endKeyIndex === -1 ? text.length : endKeyIndex;
    const lines = text
      .slice(questionsStartIndex, questionsEndIndex)
      .trim()
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => line.replace(regex, ''));

    return lines;
  }

  /**
   * Removes all content within <think>...</think> blocks
   * @param text The input text containing thinking blocks
   * @returns The text with all thinking blocks removed
   */
  private removeThinkingBlocks(text: string): string {
    // Use regex to identify and remove all <think>...</think> blocks
    // Using [\s\S] pattern to match all characters including newlines
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  getFormatInstructions(): string {
    throw new Error('Not implemented.');
  }
}

export default LineListOutputParser;
