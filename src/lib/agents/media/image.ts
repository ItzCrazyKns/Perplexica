/* I don't think can be classified as agents but to keep the structure consistent i guess ill keep it here */

import {
  RunnableSequence,
  RunnableMap,
  RunnableLambda,
} from '@langchain/core/runnables';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { searchSearxng } from '@/lib/searxng';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import LineOutputParser from '@/lib/outputParsers/lineOutputParser';
import { imageSearchFewShots, imageSearchPrompt } from '@/lib/prompts/media/image';

type ImageSearchChainInput = {
  chatHistory: BaseMessage[];
  query: string;
};

type ImageSearchResult = {
  img_src: string;
  url: string;
  title: string;
}

const outputParser = new LineOutputParser({
  key: 'query',
})

const searchImages = async (
  input: ImageSearchChainInput,
  llm: BaseChatModel,
) => {
  const chatPrompt = await ChatPromptTemplate.fromMessages([
    new SystemMessage(imageSearchPrompt),
    ...imageSearchFewShots,
    new HumanMessage(`<conversation>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation>\n<follow_up>\n${input.query}\n</follow_up>`)
  ]).formatMessages({})

  const res = await llm.invoke(chatPrompt)

  const query = await outputParser.invoke(res)

  const searchRes = await searchSearxng(query!, {
    engines: ['bing images', 'google images'],
  });

  const images: ImageSearchResult[] = [];

  searchRes.results.forEach((result) => {
    if (result.img_src && result.url && result.title) {
      images.push({
        img_src: result.img_src,
        url: result.url,
        title: result.title,
      });
    }
  });

  return images.slice(0, 10);
};

export default searchImages;