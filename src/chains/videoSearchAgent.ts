import {
  RunnableSequence,
  RunnableMap,
  RunnableLambda,
} from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import formatChatHistoryAsString from '../utils/formatHistory';
import { BaseMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { searchSearxng } from '../lib/searchEngines/searxng';
import { searchGooglePSE } from '../lib/searchEngines/google_pse';
import { searchBraveAPI } from '../lib/searchEngines/brave';
import { searchBingAPI } from '../lib/searchEngines/bing';
import { getVideoSearchEngineBackend } from '../config';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

const VideoSearchChainPrompt = `
  You will be given a conversation below and a follow up question. You need to rephrase the follow-up question so it is a standalone question that can be used by the LLM to search Youtube for videos.
  You need to make sure the rephrased question agrees with the conversation and is relevant to the conversation.

  Example:
  1. Follow up question: How does a car work?
  Rephrased: How does a car work?

  2. Follow up question: What is the theory of relativity?
  Rephrased: What is theory of relativity

  3. Follow up question: How does an AC work?
  Rephrased: How does an AC work

  Conversation:
  {chat_history}

  Follow up question: {query}
  Rephrased question:
  `;

type VideoSearchChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

const strParser = new StringOutputParser();

async function performVideoSearch(query: string) {
  const searchEngine = getVideoSearchEngineBackend();
  const youtubeQuery = `${query} site:youtube.com`;
  let videos = [];

  switch (searchEngine) {
    case 'google': {
      const googleResult = await searchGooglePSE(youtubeQuery);
      googleResult.results.forEach((result) => {
        // Use .results instead of .originalres
        if (result.img_src && result.url && result.title) {
          const videoId = new URL(result.url).searchParams.get('v');
          videos.push({
            img_src: result.img_src,
            url: result.url,
            title: result.title,
            iframe_src: videoId
              ? `https://www.youtube.com/embed/${videoId}`
              : null,
          });
        }
      });
      break;
    }

    case 'searxng': {
      const searxResult = await searchSearxng(query, {
        engines: ['youtube'],
      });
      searxResult.results.forEach((result) => {
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
      break;
    }

    case 'brave': {
      const braveResult = await searchBraveAPI(youtubeQuery);
      braveResult.results.forEach((result) => {
        if (result.img_src && result.url && result.title) {
          const videoId = new URL(result.url).searchParams.get('v');
          videos.push({
            img_src: result.img_src,
            url: result.url,
            title: result.title,
            iframe_src: videoId
              ? `https://www.youtube.com/embed/${videoId}`
              : null,
          });
        }
      });
      break;
    }

    case 'yacy': {
      console.log('Not available for yacy');
      videos = [];
      break;
    }

    case 'bing': {
      const bingResult = await searchBingAPI(youtubeQuery);
      bingResult.results.forEach((result) => {
        if (result.img_src && result.url && result.title) {
          const videoId = new URL(result.url).searchParams.get('v');
          videos.push({
            img_src: result.img_src,
            url: result.url,
            title: result.title,
            iframe_src: videoId
              ? `https://www.youtube.com/embed/${videoId}`
              : null,
          });
        }
      });
      break;
    }

    default:
      throw new Error(`Unknown search engine ${searchEngine}`);
  }

  return videos;
}

const createVideoSearchChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (input: VideoSearchChainInput) => {
        return formatChatHistoryAsString(input.chat_history);
      },
      query: (input: VideoSearchChainInput) => {
        return input.query;
      },
    }),
    PromptTemplate.fromTemplate(VideoSearchChainPrompt),
    llm,
    strParser,
    RunnableLambda.from(async (input: string) => {
      const videos = await performVideoSearch(input);
      return videos.slice(0, 10);
    }),
  ]);
};

const handleVideoSearch = (
  input: VideoSearchChainInput,
  llm: BaseChatModel,
) => {
  const VideoSearchChain = createVideoSearchChain(llm);
  return VideoSearchChain.invoke(input);
};

export default handleVideoSearch;
