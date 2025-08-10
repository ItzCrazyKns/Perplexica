import {
  RunnableSequence,
  RunnableMap,
  RunnableLambda,
} from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import formatChatHistoryAsString from '../utils/formatHistory';
import { BaseMessage } from '@langchain/core/messages';
import LineOutputParser from '../outputParsers/lineOutputParser';
import { searchSearxng } from '../searxng';
import { formatDateForLLM } from '../utils';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getLangfuseCallbacks } from '@/lib/tracing/langfuse';

const VideoSearchChainPrompt = `
# Instructions
- You will be given a question from a user and a conversation history
- Rephrase the question based on the conversation so it is a standalone question that can be used to search Youtube for videos
- Ensure the rephrased question agrees with the conversation and is relevant to the conversation
- If you are thinking or reasoning, use <think> tags to indicate your thought process
- If you are thinking or reasoning, do not use <answer> and </answer> tags in your thinking. Those tags should only be used in the final output
- Use the provided date to ensure the rephrased question is relevant to the current date and time if applicable

# Data locations
- The history is contained in the <conversation> tag after the <examples> below
- The user question is contained in the <question> tag after the <examples> below
- Output your answer in an <answer> tag
- Current date is: {date}
- Do not include any other text in your answer
  
<examples>
## Example 1 input
<conversation>
  Who won the last F1 race?\nAyrton Senna won the Monaco Grand Prix. It was a tight race with lots of overtakes. Alain Prost was in the lead for most of the race until the last lap when Senna overtook them.
</conversation>
<question>
  What were the highlights of the race?
</question>

## Example 1 output
<answer>
  F1 Monaco Grand Prix highlights
</answer>

## Example 2 input
<conversation>
  What is the theory of relativity?
</conversation>
<question>
  What is the theory of relativity?
</question>

## Example 2 output
<answer>
  What is the theory of relativity?
</answer>

## Example 3 input
<conversation>
  I'm looking for a nice vacation spot. Where do you suggest?\nI suggest you go to Hawaii. It's a beautiful place with lots of beaches and activities to do.\nI love the beach! What are some activities I can do there?\nYou can go surfing, snorkeling, or just relax on the beach.
</conversation>
<question>
  What are some activities I can do in Hawaii?
</question>

## Example 3 output
<answer>
  Activities to do in Hawaii
</answer>
</examples>

<conversation>
{chat_history}
</conversation>
<question>
{query}
</question>
`;

type VideoSearchChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

interface VideoSearchResult {
  img_src: string;
  url: string;
  title: string;
  iframe_src: string;
}

const answerParser = new LineOutputParser({
  key: 'answer',
});

const createVideoSearchChain = (
  llm: BaseChatModel,
  systemInstructions?: string,
) => {
  const systemPrompt = systemInstructions ? `${systemInstructions}\n\n` : '';

  const fullPrompt = `${systemPrompt}${VideoSearchChainPrompt}`;

  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (input: VideoSearchChainInput) => {
        return formatChatHistoryAsString(input.chat_history);
      },
      query: (input: VideoSearchChainInput) => {
        return input.query;
      },
      date: () => formatDateForLLM(),
    }),
    PromptTemplate.fromTemplate(fullPrompt),
    llm,
    answerParser,
    RunnableLambda.from(async (searchQuery: string) => {
      const res = await searchSearxng(searchQuery, {
        engines: ['youtube'],
      });

      const videos: VideoSearchResult[] = [];

      res.results.forEach((result) => {
        if (
          result.thumbnail &&
          result.url &&
          result.title &&
          result.iframe_src
        ) {
          videos.push({
            img_src: result.thumbnail,
            url: result.url,
            title: result.title,
            iframe_src: result.iframe_src,
          });
        }
      });

      return videos;
    }),
  ]);
};

const handleVideoSearch = (
  input: VideoSearchChainInput,
  llm: BaseChatModel,
  systemInstructions?: string,
) => {
  const VideoSearchChain = createVideoSearchChain(llm, systemInstructions);
  return VideoSearchChain.invoke(input, { ...getLangfuseCallbacks() });
};

export default handleVideoSearch;
