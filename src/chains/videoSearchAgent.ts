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
import { getSearchEngineBackend } from '../config';
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

function extractYouTubeVideoId(url: string): string | null {
  const regex = /(?:v=|\/embed\/|\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function performVideoSearch(query: string) {
  const searchEngine = getSearchEngineBackend();
  const youtubeQuery = `${query} site:youtube.com`;
  let videos = [];

  switch (searchEngine) {
    case 'google': {
      const googleResult = await searchGooglePSE(youtubeQuery);
      googleResult.originalres.results.forEach((result) => {
        // Extract video metadata from Google PSE results
        const thumbnail = result.pagemap?.cse_thumbnail?.[0]?.src 
                         || result.pagemap?.videoobject?.[0]?.thumbnailurl;

        if (thumbnail && result.link && result.title) {
          videos.push({
            img_src: thumbnail,
            url: result.link,
            title: result.title,
            // Construct iframe URL from YouTube video ID
            iframe_src: result.link.includes('youtube.com/watch?v=')
              ? `https://www.youtube.com/embed/${result.link.split('v=')[1].split('&')[0]}`
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