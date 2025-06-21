import { 
  BaseMessage, 
  AIMessage, 
  HumanMessage, 
  SystemMessage 
} from '@langchain/core/messages';

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

/**
 * Removes thinking blocks from the content of an array of BaseMessage objects
 * @param messages Array of BaseMessage objects
 * @returns New array with thinking blocks removed from each message's content
 */
export const removeThinkingBlocksFromMessages = (messages: BaseMessage[]): BaseMessage[] => {
  return messages.map(message => {
    // Only process string content, leave complex content as-is
    if (typeof message.content !== 'string') {
      return message;
    }

    const cleanedContent = removeThinkingBlocks(message.content);
    
    // Create new instance of the same message type with cleaned content
    if (message instanceof AIMessage) {
      return new AIMessage(cleanedContent);
    } else if (message instanceof HumanMessage) {
      return new HumanMessage(cleanedContent);
    } else if (message instanceof SystemMessage) {
      return new SystemMessage(cleanedContent);
    } else {
      // For any other message types, return the original message unchanged
      // This is a safe fallback for custom message types
      return message;
    }
  });
};