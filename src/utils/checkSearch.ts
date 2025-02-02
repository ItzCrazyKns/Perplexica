import { shouldPerformSearchPrompt } from '../prompts/shouldSearch';
import { HumanMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import logger from './logger'; // Ensure the logger module is correctly imported

/**
 * Determines whether an external search is required.
 * @param llm - The AI language model instance.
 * @param query - The user's message.
 * @param history - Chat history.
 * @returns {Promise<boolean>} - True if search is needed, False otherwise.
 */

export const checkIfSearchIsNeeded = async (
  llm: BaseChatModel,
  query: string,
  history: Array<[string, string]>
): Promise<boolean> => {
  const prompt = shouldPerformSearchPrompt(query, history);

  logger.info(`📜 Generated Search Decision Prompt for query "${query}":\n${prompt}`);

  try {
    const response = await llm.invoke([new HumanMessage({ content: prompt })]);

    // Log the raw response from LLM
    logger.info(`🔍 Raw Response from LLM for query "${query}": ${JSON.stringify(response)}`);

    const decision = String(response?.content || '').trim().toLowerCase();

    // Log the decision for debugging
    logger.info(`🔍 Search Decision for query "${query}": "${decision}"`);

    if (decision === 'yes') {
      logger.debug(`✅ Search Required for Query: "${query}"`);
      return true;
    } else if (decision === 'no') {
      logger.debug(`❌ No Search Needed for Query: "${query}"`);
      return false;
    } else {
      logger.warn(`⚠️ Unexpected Search Decision Output: "${decision}" (Defaulting to NO)`);
      return false;
    }
  } catch (error) {
    logger.error(`❌ Error in Search Decision: ${error}`);
    return false;
  }
};
