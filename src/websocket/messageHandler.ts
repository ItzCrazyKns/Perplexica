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
import logger from '../utils/logger';
import db from '../db';
import { chats, messages } from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import redisClient from '../utils/redisClient';

type Message = {
  messageId: string;
  chatId: string;
  content: string;
  cache: string;
};

type WSMessage = {
  message: Message;
  copilot: boolean;
  type: string;
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
  messageId: string,
  chatId: string,
  cacheKey: string,
  shouldCache: boolean,
) => {
  let recievedMessage = '';
  let sources = [];

  emitter.on('data', (data) => {
    const parsedData = JSON.parse(data);
    if (parsedData.type === 'response') {
      ws.send(
        JSON.stringify({
          type: 'message',
          data: parsedData.data,
          messageId: messageId,
        }),
      );
      recievedMessage += parsedData.data;
    } else if (parsedData.type === 'sources') {
      ws.send(
        JSON.stringify({
          type: 'sources',
          data: parsedData.data,
          messageId: messageId,
        }),
      );
      sources = parsedData.data;
    }
  });

  emitter.on('end', async () => {
    ws.send(JSON.stringify({ type: 'messageEnd', messageId: messageId }));

    // Guardar el mensaje recibido en la base de datos
    await db
      .insert(messages)
      .values({
        content: recievedMessage,
        chatId: chatId,
        messageId: messageId,
        role: 'assistant',
        metadata: JSON.stringify({
          createdAt: new Date(),
          ...(sources && sources.length > 0 && { sources }),
        }),
      })
      .execute();

    // Almacenar la respuesta en caché si shouldCache es true
    if (shouldCache) {
      const responseWithSources = {
        content: recievedMessage,
        chatId: chatId,
        messageId: messageId,
        role: 'assistant',
        metadata: JSON.stringify(sources),
      };
      await redisClient
        .setEx(cacheKey, 86400, JSON.stringify(responseWithSources))
        .then(() => logger.info(`Cache set for ${cacheKey}`))
        .catch((err) => logger.error(`Redis setEx error: ${err}`));
    }
  });

  emitter.on('error', (data) => {
    const parsedData = JSON.parse(data);
    ws.send(
      JSON.stringify({
        type: 'error',
        data: parsedData.data,
        key: 'CHAIN_ERROR',
      }),
    );
  });
};

export const handleMessage = async (
  message: string,
  ws: WebSocket,
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  try {
    const parsedWSMessage = JSON.parse(message) as WSMessage;
    const parsedMessage = parsedWSMessage.message;
    const id = crypto.randomBytes(7).toString('hex');

    if (!parsedMessage.content)
      return ws.send(
        JSON.stringify({
          type: 'error',
          data: 'Invalid message format',
          key: 'INVALID_FORMAT',
        }),
      );

    const cacheKey = parsedMessage.content;
    const shouldCache = parsedMessage.cache === '1';

    if (shouldCache) {
      const cachedResponse = await redisClient.get(cacheKey);

      if (cachedResponse) {
        const jsonDatabase = JSON.parse(cachedResponse);

        ws.send(
          JSON.stringify({
            type: 'message',
            data: jsonDatabase.content,
            messageId: jsonDatabase.messageId,
          }),
        );
        const sources = JSON.parse(jsonDatabase.metadata);
        ws.send(
          JSON.stringify({
            type: 'sources',
            data: sources,
            messageId: jsonDatabase.messageId,
            cache: true,
          }),
        );
        await db
          .insert(chats)
          .values({
            id: parsedMessage.chatId,
            title: parsedMessage.content,
            createdAt: new Date().toString(),
            focusMode: parsedWSMessage.focusMode,
          })
          .execute();
        await db
          .insert(messages)
          .values({
            content: parsedMessage.content,
            chatId: parsedMessage.chatId,
            messageId: jsonDatabase.messageId,
            role: 'user',
            metadata: JSON.stringify({
              createdAt: new Date(),
            }),
          })
          .execute();
        await db
          .insert(messages)
          .values({
            content: jsonDatabase.content,
            chatId: parsedMessage.chatId,
            messageId: jsonDatabase.messageId,
            role: jsonDatabase.role,
            metadata: JSON.stringify({
              createdAt: new Date(),
              ...(sources && sources.length > 0 && { sources }),
            }),
          })
          .execute();
        return;
      }
    }

    const history: BaseMessage[] = parsedWSMessage.history.map((msg) => {
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

    if (parsedWSMessage.type === 'message') {
      const handler = searchHandlers[parsedWSMessage.focusMode];

      if (handler) {
        const emitter = handler(
          parsedMessage.content,
          history,
          llm,
          embeddings,
        );

        handleEmitterEvents(
          emitter,
          ws,
          id,
          parsedMessage.chatId,
          cacheKey,
          shouldCache,
        );

        const chat = await db.query.chats.findFirst({
          where: eq(chats.id, parsedMessage.chatId),
        });

        if (!chat) {
          await db
            .insert(chats)
            .values({
              id: parsedMessage.chatId,
              title: parsedMessage.content,
              createdAt: new Date().toString(),
              focusMode: parsedWSMessage.focusMode,
            })
            .execute();
        }

        await db
          .insert(messages)
          .values({
            content: parsedMessage.content,
            chatId: parsedMessage.chatId,
            messageId: id,
            role: 'user',
            metadata: JSON.stringify({
              createdAt: new Date(),
            }),
          })
          .execute();
      } else {
        ws.send(
          JSON.stringify({
            type: 'error',
            data: 'Invalid focus mode',
            key: 'INVALID_FOCUS_MODE',
          }),
        );
      }
    }
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'error',
        data: 'Invalid message format',
        key: 'INVALID_FORMAT',
      }),
    );
    logger.error(`Failed to handle message: ${err}`);
  }
};
