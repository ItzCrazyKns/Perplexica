import prompts from '@/lib/prompts';
import MetaSearchAgent from '@/lib/search/metaSearchAgent';
import crypto from 'crypto';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { EventEmitter } from 'stream';
import {
  chatModelProviders,
  embeddingModelProviders,
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '@/lib/providers';
import db from '@/lib/db';
import { chats, messages as messagesSchema } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { getFileDetails } from '@/lib/utils/files';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '@/lib/config';
import { searchHandlers } from '@/lib/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Message = {
  messageId: string;
  chatId: string;
  content: string;
};

type ChatModel = {
  provider: string;
  name: string;
};

type EmbeddingModel = {
  provider: string;
  name: string;
};

type Body = {
  message: Message;
  optimizationMode: 'speed' | 'balanced' | 'quality';
  focusMode: string;
  history: Array<[string, string]>;
  files: Array<string>;
  chatModel: ChatModel;
  embeddingModel: EmbeddingModel;
  systemInstructions: string;
};

const handleEmitterEvents = async (
  stream: EventEmitter,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  aiMessageId: string,
  chatId: string,
) => {
  let recievedMessage = '';
  let sources: any[] = [];
  let sentGeneratingStatus = false;

  stream.on('data', (data: string) => {
    const parsedData = JSON.parse(data);
    if (parsedData.type === 'response') {
      if (!sentGeneratingStatus) {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'status',
              data: 'Generating answer...',
            }) + '\n',
          ),
        );
        sentGeneratingStatus = true;
      }
      writer.write(
        encoder.encode(
          JSON.stringify({
            type: 'message',
            data: parsedData.data,
            messageId: aiMessageId,
          }) + '\n',
        ),
      );

      recievedMessage += parsedData.data;
    } else if (parsedData.type === 'sources') {
      if (!sentGeneratingStatus) {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'status',
              data: 'Generating answer...',
            }) + '\n',
          ),
        );
        sentGeneratingStatus = true;
      }
      writer.write(
        encoder.encode(
          JSON.stringify({
            type: 'sources',
            data: parsedData.data,
            messageId: aiMessageId,
          }) + '\n',
        ),
      );

      sources = parsedData.data;
    }
  });
  stream.on('end', () => {
    writer.write(
      encoder.encode(
        JSON.stringify({
          type: 'messageEnd',
          messageId: aiMessageId,
        }) + '\n',
      ),
    );
    writer.close();

    db.insert(messagesSchema)
      .values({
        content: recievedMessage,
        chatId: chatId,
        messageId: aiMessageId,
        role: 'assistant',
        metadata: JSON.stringify({
          createdAt: new Date(),
          ...(sources && sources.length > 0 && { sources }),
        }),
      })
      .execute();
  });
  stream.on('error', (data: string) => {
    const parsedData = JSON.parse(data);
    writer.write(
      encoder.encode(
        JSON.stringify({
          type: 'status',
          data: 'Chat completion failed.',
        }) + '\n',
      ),
    );
    writer.write(
      encoder.encode(
        JSON.stringify({
          type: 'error',
          data: parsedData.data,
        }),
      ),
    );
    writer.close();
  });
};

const handleHistorySave = async (
  message: Message,
  humanMessageId: string,
  focusMode: string,
  files: string[],
) => {
  const chat = await db.query.chats.findFirst({
    where: eq(chats.id, message.chatId),
  });

  if (!chat) {
    await db
      .insert(chats)
      .values({
        id: message.chatId,
        title: message.content,
        createdAt: new Date().toString(),
        focusMode: focusMode,
        files: files.map(getFileDetails),
      })
      .execute();
  }

  const messageExists = await db.query.messages.findFirst({
    where: eq(messagesSchema.messageId, humanMessageId),
  });

  if (!messageExists) {
    await db
      .insert(messagesSchema)
      .values({
        content: message.content,
        chatId: message.chatId,
        messageId: humanMessageId,
        role: 'user',
        metadata: JSON.stringify({
          createdAt: new Date(),
        }),
      })
      .execute();
  } else {
    await db
      .delete(messagesSchema)
      .where(
        and(
          gt(messagesSchema.id, messageExists.id),
          eq(messagesSchema.chatId, message.chatId),
        ),
      )
      .execute();
  }
};

export const POST = async (req: Request) => {
  try {
    const body = (await req.json()) as Body;
    const { message } = body;

    if (message.content === '') {
      return Response.json(
        {
          message: 'Please provide a message to process',
        },
        { status: 400 },
      );
    }

    const [chatModelProviders, embeddingModelProviders] = await Promise.all([
      getAvailableChatModelProviders(),
      getAvailableEmbeddingModelProviders(),
    ]);

    const chatModelProvider =
      chatModelProviders[
        body.chatModel?.provider || Object.keys(chatModelProviders)[0]
      ];
    const chatModel =
      chatModelProvider[
        body.chatModel?.name || Object.keys(chatModelProvider)[0]
      ];

    const embeddingProvider =
      embeddingModelProviders[
        body.embeddingModel?.provider || Object.keys(embeddingModelProviders)[0]
      ];
    const embeddingModel =
      embeddingProvider[
        body.embeddingModel?.name || Object.keys(embeddingProvider)[0]
      ];

    const selectedChatProviderKey =
      body.chatModel?.provider || Object.keys(chatModelProviders)[0];
    const selectedChatModelKey =
      body.chatModel?.name || Object.keys(chatModelProvider)[0];
    const selectedEmbeddingProviderKey =
      body.embeddingModel?.provider || Object.keys(embeddingModelProviders)[0];
    const selectedEmbeddingModelKey =
      body.embeddingModel?.name || Object.keys(embeddingProvider)[0];

    console.log('[Models] Chat request', {
      chatProvider: selectedChatProviderKey,
      chatModel: selectedChatModelKey,
      embeddingProvider: selectedEmbeddingProviderKey,
      embeddingModel: selectedEmbeddingModelKey,
      ...(selectedChatProviderKey === 'custom_openai'
        ? { chatBaseURL: getCustomOpenaiApiUrl() }
        : {}),
      ...(selectedEmbeddingProviderKey === 'custom_openai'
        ? { embeddingBaseURL: getCustomOpenaiApiUrl() }
        : {}),
    });

    let llm: BaseChatModel | undefined;
    let embedding = embeddingModel.model;

    if (body.chatModel?.provider === 'custom_openai') {
      llm = new ChatOpenAI({
        apiKey: getCustomOpenaiApiKey(),
        modelName: getCustomOpenaiModelName(),
        temperature: 0.7,
        configuration: {
          baseURL: getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    } else if (chatModelProvider && chatModel) {
      llm = chatModel.model;
    }

    if (!llm) {
      return Response.json({ error: 'Invalid chat model' }, { status: 400 });
    }

    if (!embedding) {
      return Response.json(
        { error: 'Invalid embedding model' },
        { status: 400 },
      );
    }

    const humanMessageId =
      message.messageId ?? crypto.randomBytes(7).toString('hex');
    const aiMessageId = crypto.randomBytes(7).toString('hex');

    const history: BaseMessage[] = body.history.map((msg) => {
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

    const handler = searchHandlers[body.focusMode];

    if (!handler) {
      return Response.json(
        {
          message: 'Invalid focus mode',
        },
        { status: 400 },
      );
    }

    const llmProxy = new Proxy(llm as any, {
      get(target, prop, receiver) {
        if (
          prop === 'invoke' ||
          prop === 'stream' ||
          prop === 'streamEvents' ||
          prop === 'generate'
        ) {
          return (...args: any[]) => {
            console.log('[Models] Chat model call', {
              provider: selectedChatProviderKey,
              model: selectedChatModelKey,
              method: String(prop),
            });
            return (target as any)[prop](...args);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    const embeddingProxy = new Proxy(embedding as any, {
      get(target, prop, receiver) {
        if (prop === 'embedQuery' || prop === 'embedDocuments') {
          return (...args: any[]) => {
            console.log('[Models] Embedding model call', {
              provider: selectedEmbeddingProviderKey,
              model: selectedEmbeddingModelKey,
              method: String(prop),
              size:
                prop === 'embedDocuments'
                  ? Array.isArray(args[0])
                    ? args[0].length
                    : undefined
                  : undefined,
            });
            return (target as any)[prop](...args);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    const stream = await handler.searchAndAnswer(
      message.content,
      history,
      llmProxy as any,
      embeddingProxy as any,
      body.optimizationMode,
      body.files,
      body.systemInstructions,
    );

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    writer.write(
      encoder.encode(
        JSON.stringify({
          type: 'status',
          data:
            body.focusMode === 'writingAssistant'
              ? 'Waiting for chat completion...'
              : 'Searching web...',
        }) + '\n',
      ),
    );

    handleEmitterEvents(stream, writer, encoder, aiMessageId, message.chatId);
    handleHistorySave(message, humanMessageId, body.focusMode, body.files);

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    console.error('An error occurred while processing chat request:', err);
    return Response.json(
      { message: 'An error occurred while processing chat request' },
      { status: 500 },
    );
  }
};
