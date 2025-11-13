import { ChatPromptTemplate } from '@langchain/core/prompts';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { searchSearxng } from '@/lib/searxng';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import LineOutputParser from '@/lib/outputParsers/lineOutputParser';
import { videoSearchFewShots, videoSearchPrompt } from '@/lib/prompts/media/videos';

type VideoSearchChainInput = {
  chatHistory: BaseMessage[];
  query: string;
};

type VideoSearchResult = {
  img_src: string;
  url: string;
  title: string;
  iframe_src: string;
}

const outputParser = new LineOutputParser({
  key: 'query',
});

const searchVideos = async (
  input: VideoSearchChainInput,
  llm: BaseChatModel,
) => {
  const chatPrompt = await ChatPromptTemplate.fromMessages([
    new SystemMessage(videoSearchPrompt),
    ...videoSearchFewShots,
    new HumanMessage(`<conversation>${formatChatHistoryAsString(input.chatHistory)}\n</conversation>\n<follow_up>\n${input.query}\n</follow_up>`)
  ]).formatMessages({})

  const res = await llm.invoke(chatPrompt)

  const query = await outputParser.invoke(res)

  const searchRes = await searchSearxng(query!, {
    engines: ['youtube'],
  });

  const videos: VideoSearchResult[] = [];

  searchRes.results.forEach((result) => {
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

  return videos.slice(0, 10);

};

export default searchVideos;
