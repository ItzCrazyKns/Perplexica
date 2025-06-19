/**
 * Removes all content within <think>...</think> blocks
 * @param text The input text containing thinking blocks
 * @returns The text with all thinking blocks removed
 */
export const removeThinkingBlocks = (text: string): string => {
  // Use regex to identify and remove all <think>...</think> blocks
  // Using the 's' flag to make dot match newlines
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
};
