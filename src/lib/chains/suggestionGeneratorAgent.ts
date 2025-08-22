import { RunnableSequence, RunnableMap } from '@langchain/core/runnables';
import ListLineOutputParser from '../outputParsers/listLineOutputParser';
import { PromptTemplate } from '@langchain/core/prompts';
import formatChatHistoryAsString from '../utils/formatHistory';
import { BaseMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { getPromptLanguageName } from '@/i18n/locales';

const suggestionGeneratorPrompt = `
You are an AI suggestion generator for an AI powered search engine.

Your need to meet these requirements:
- You will be given a conversation below. You need to generate 4-5 suggestions based on the conversation.
- The suggestion should be relevant to the conversation that can be used by the user to ask the chat model for more information.
- You need to make sure the suggestions are relevant to the conversation and are helpful to the user. Keep a note that the user might use these suggestions to ask a chat model for more information.

### Language Instructions
- **Language Definition**: Interpret "{language}" as a combination of language and optional region.
  - Format: "language (region)" or "language（region）" (e.g., "English (US)", "繁體中文（台灣）").
  - The main language indicates the linguistic system (e.g., English, 繁體中文, 日本語).
  - The region in parentheses indicates the regional variant or locale style (e.g., US, UK, 台灣, 香港, France).
- **Primary Language**: Use "{language}" for all non-code content, including explanations, descriptions, and examples.
- **Regional Variants**: Adjust word choice, spelling, and style according to the region specified in "{language}" (e.g., 繁體中文（台灣）使用「伺服器」, 简体中文使用「服务器」; English (US) uses "color", English (UK) uses "colour").
- **Code and Comments**: All code blocks and code comments must be entirely in "English (US)".
- **Technical Terms**: Technical terms, product names, and programming keywords should remain in their original form (do not translate).
- **Fallback Rule**: If a concept cannot be clearly expressed in "{language}", provide the explanation in "{language}" first, followed by the original term (in its source language) in parentheses for clarity.
- **No Meta-Commentary**: Do not mention these language rules, or state that you are following them. Simply apply them in your response without explanation.

### Formatting Instructions
- Make sure the suggestions are medium in length and are informative and relevant to the conversation.
- Provide these suggestions separated by newlines between the XML tags <suggestions> and </suggestions>. For example:
<suggestions>
Tell me more about SpaceX and their recent projects
What is the latest news on SpaceX?
Who is the CEO of SpaceX?
</suggestions>

Conversation:
{chat_history}
`;

type SuggestionGeneratorInput = {
  chat_history: BaseMessage[];
  locale: string;
};

const outputParser = new ListLineOutputParser({
  key: 'suggestions',
});

const createSuggestionGeneratorChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (input: SuggestionGeneratorInput) =>
        formatChatHistoryAsString(input.chat_history),
      language: (input: SuggestionGeneratorInput) =>
        getPromptLanguageName(input.locale),
    }),
    PromptTemplate.fromTemplate(suggestionGeneratorPrompt),
    llm,
    outputParser,
  ]);
};

const generateSuggestions = (
  input: SuggestionGeneratorInput,
  llm: BaseChatModel,
) => {
  (llm as unknown as ChatOpenAI).temperature = 0;
  const suggestionGeneratorChain = createSuggestionGeneratorChain(llm);
  return suggestionGeneratorChain.invoke(input);
};

export default generateSuggestions;
