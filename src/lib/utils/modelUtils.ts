import { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Extract the model name from an LLM instance
 * Handles different LLM implementations that may store the model name in different properties
 * @param llm The LLM instance
 * @returns The model name or 'Unknown' if not found
 */
export function getModelName(llm: BaseChatModel): string {
  try {
    // @ts-ignore - Different LLM implementations have different properties
    if (llm.modelName) {
      // @ts-ignore
      return llm.modelName;
    }

    // @ts-ignore
    if (llm._llm && llm._llm.modelName) {
      // @ts-ignore
      return llm._llm.modelName;
    }

    // @ts-ignore
    if (llm.model && llm.model.modelName) {
      // @ts-ignore
      return llm.model.modelName;
    }

    if ('model' in llm) {
      // @ts-ignore
      const model = llm.model;
      if (typeof model === 'string') {
        return model;
      }
      // @ts-ignore
      if (model && model.modelName) {
        // @ts-ignore
        return model.modelName;
      }
    }

    if (llm.constructor && llm.constructor.name) {
      // Last resort: use the class name
      return llm.constructor.name;
    }

    return 'Unknown';
  } catch (e) {
    console.error('Failed to get model name:', e);
    return 'Unknown';
  }
}
