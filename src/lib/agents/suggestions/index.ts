import ListLineOutputParser from '@/lib/outputParsers/listLineOutputParser';
import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { suggestionGeneratorPrompt } from '@/lib/prompts/suggestions';

type SuggestionGeneratorInput = {
  chatHistory: BaseMessage[];
};

const outputParser = new ListLineOutputParser({
  key: 'suggestions',
});

const generateSuggestions = async (
  input: SuggestionGeneratorInput,
  llm: BaseChatModel,
) => {
  const chatPrompt = await ChatPromptTemplate.fromMessages([
    new SystemMessage(suggestionGeneratorPrompt),
    new HumanMessage(`<conversation>${formatChatHistoryAsString(input.chatHistory)}</conversation>`)
  ]).formatMessages({})

  const res = await llm.invoke(chatPrompt)

  const suggestions = await outputParser.invoke(res)

  return suggestions
};

export default generateSuggestions;
