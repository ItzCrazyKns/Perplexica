import { EventEmitter, WebSocket } from 'ws';
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import handleWebSearch from '../agents/webSearchAgent';
import handleAcademicSearch from '../agents/academicSearchAgent';
import handleWritingAssistant from '../agents/writingAssistant';
import handleWolframAlphaSearch from '../agents/wolframAlphaSearchAgent';
import handleYoutubeSearch from '../agents/youtubeSearchAgent';
import handleRedditSearch from '../agents/redditSearchAgent';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';

type Message = {
  type: string;
  content: string;
  copilot: boolean;
  focusMode: string;
  history: Array<[string, string]>;
};

const searchHandlers = {
  webSearch: handleWebSearch,
  academicSearch: handleAcademicSearch,
  writingAssistant: handleWritingAssistant,
  wolframAlphaSearch: handleWolframAlphaSearch,
  youtubeSearch: handleYoutubeSearch,
  redditSearch: handleRedditSearch,
};

const handleEmitterEvents = (
  emitter: EventEmitter,
  ws: WebSocket,
  id: string,
) => {
  emitter.on('data', (data) => {
    const parsedData = JSON.parse(data);
    if (parsedData.type === 'response') {
      ws.send(
        JSON.stringify({
          type: 'message',
          data: parsedData.data,
          messageId: id,
        }),
      );
    } else if (parsedData.type === 'sources') {
      ws.send(
        JSON.stringify({
          type: 'sources',
          data: parsedData.data,
          messageId: id,
        }),
      );
    }
  });
  emitter.on('end', () => {
    ws.send(JSON.stringify({ type: 'messageEnd', messageId: id }));
  });
  emitter.on('error', (data) => {
    const parsedData = JSON.parse(data);
    ws.send(JSON.stringify({ type: 'error', data: parsedData.data }));
  });
};

export const handleMessage = async (
  message: string,
  ws: WebSocket,
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  let parsedMessage: Message;
  try {
    parsedMessage = JSON.parse(message) as Message;
    console.log('Message parsed successfully:', parsedMessage);
  } catch (error) {
    console.error('Error parsing message:', message, error);
    return ws.send(
      JSON.stringify({ type: 'error', data: 'Invalid message format' }),
    );
  }

  const id = Math.random().toString(36).substring(7);
  console.log('Generated message ID:', id);

  if (!parsedMessage.content) {
    console.log('Message content is empty');
    return ws.send(
      JSON.stringify({ type: 'error', data: 'Invalid message format' }),
    );
  }

  const history: BaseMessage[] = parsedMessage.history.map((msg) => {
    if (msg[0] === 'human') {
      return new HumanMessage({
        content: msg[1],
      });
    } else {
      return new AIMessage({
        content: msg[1],
      });
    }
  });

  if (parsedMessage.type === 'message') {
    const handler = searchHandlers[parsedMessage.focusMode];
    if (handler) {
      console.log('Handling message with focus mode:', parsedMessage.focusMode);
      try {
        const emitter = handler(
          parsedMessage.content,
          history,
          llm,
          embeddings,
        );
        handleEmitterEvents(emitter, ws, id);
      } catch (error) {
        console.error(
          'Error handling message with handler:',
          parsedMessage.focusMode,
          error,
        );
        ws.send(JSON.stringify({ type: 'error', data: 'Handler failure' }));
      }
    } else {
      console.log('Invalid focus mode:', parsedMessage.focusMode);
      ws.send(JSON.stringify({ type: 'error', data: 'Invalid focus mode' }));
    }
  }
};
