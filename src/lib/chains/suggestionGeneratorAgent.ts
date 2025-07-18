import { RunnableSequence, RunnableMap } from '@langchain/core/runnables';
import ListLineOutputParser from '../outputParsers/listLineOutputParser';
import { PromptTemplate } from '@langchain/core/prompts';
import formatChatHistoryAsString from '../utils/formatHistory';
import { BaseMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';

const suggestionGeneratorPrompt = `
You are an AI suggestion generator for an AI powered search engine.

# Instructions
- You will be given a conversation below
- Generate 5 total suggestions based on the conversation
  - Three of the suggestions should be relevant to the conversation so it can be used by the user to ask the chat model for more information
  - Two of the suggestions should still be relevant to the conversation but could optionally steer the conversation in a different direction
  - The suggestions should be in the form of questions
  - The suggestions should not be something that is already in the conversation
- The conversation history is provided in the conversation section below

 # Output Format
- If you are a thinking or reasoning AI, you should avoid using \`<suggestions>\` and \`</suggestions>\` tags in your thinking. Those tags should only be used in the final output.
- Provide these suggestions separated by newlines between the XML tags <suggestions> and </suggestions>. For example:
- Make sure each suggestion is a single line and does not contain any newlines or any formatting
- Example output is provided in the example section below

<example>
<suggestions>
Tell me more about SpaceX and their recent projects
What is the latest news on SpaceX?
Who is the CEO of SpaceX?
</suggestions>
</example>

<conversation>
{chat_history}
</conversation>
`;

type SuggestionGeneratorInput = {
  chat_history: BaseMessage[];
};

const outputParser = new ListLineOutputParser({
  key: 'suggestions',
});

const createSuggestionGeneratorChain = (
  llm: BaseChatModel,
  systemInstructions?: string,
) => {
  const systemPrompt = systemInstructions ? `${systemInstructions}\n\n` : '';

  const fullPrompt = `${systemPrompt}${suggestionGeneratorPrompt}`;

  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (input: SuggestionGeneratorInput) =>
        formatChatHistoryAsString(input.chat_history),
    }),
    PromptTemplate.fromTemplate(fullPrompt),
    llm,
    outputParser,
  ]);
};

const generateSuggestions = (
  input: SuggestionGeneratorInput,
  llm: BaseChatModel,
  systemInstructions?: string,
) => {
  (llm as unknown as ChatOpenAI).temperature = 0;
  const suggestionGeneratorChain = createSuggestionGeneratorChain(
    llm,
    systemInstructions,
  );
  return suggestionGeneratorChain.invoke(input);
};

export default generateSuggestions;
