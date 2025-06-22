import { cleanupCancelToken, registerCancelToken } from '@/lib/cancel-tokens';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '@/lib/config';
import db from '@/lib/db';
import { chats, messages as messagesSchema } from '@/lib/db/schema';
import {
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '@/lib/providers';
import { searchHandlers } from '@/lib/search';
import { getFileDetails } from '@/lib/utils/files';
import { getSystemPrompts } from '@/lib/utils/prompts';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import crypto from 'crypto';
import { and, eq, gt } from 'drizzle-orm';
import { EventEmitter } from 'stream';

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
  ollamaContextWindow?: number;
};

type EmbeddingModel = {
  provider: string;
  name: string;
};

type Body = {
  message: Message;
  optimizationMode: 'speed' | 'balanced' | 'agent';
  focusMode: string;
  history: Array<[string, string]>;
  files: Array<string>;
  chatModel: ChatModel;
  embeddingModel: EmbeddingModel;
  systemInstructions: string;
  selectedSystemPromptIds: string[];
};

type ModelStats = {
  modelName: string;
  responseTime?: number;
};

const handleEmitterEvents = async (
  stream: EventEmitter,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  aiMessageId: string,
  chatId: string,
  startTime: number,
  userMessageId: string,
  abortController: AbortController,
) => {
  let recievedMessage = '';
  let sources: any[] = [];
  let searchQuery: string | undefined;
  let searchUrl: string | undefined;
  let isStreamActive = true;

  // Keep-alive ping mechanism to prevent reverse proxy timeouts
  const pingInterval = setInterval(() => {
    if (isStreamActive) {
      try {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'ping',
              timestamp: Date.now(),
            }) + '\n',
          ),
        );
      } catch (error) {
        // If writing fails, the connection is likely closed
        clearInterval(pingInterval);
        isStreamActive = false;
      }
    } else {
      clearInterval(pingInterval);
    }
  }, 30000); // Send ping every 30 seconds

  // Clean up ping interval if request is cancelled
  abortController.signal.addEventListener('abort', () => {
    isStreamActive = false;
    clearInterval(pingInterval);
  });

  stream.on('data', (data) => {
    const parsedData = JSON.parse(data);
    if (parsedData.type === 'response') {
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
      // Capture the search query if available
      if (parsedData.searchQuery) {
        searchQuery = parsedData.searchQuery;
      }
      if (parsedData.searchUrl) {
        searchUrl = parsedData.searchUrl;
      }

      writer.write(
        encoder.encode(
          JSON.stringify({
            type: 'sources',
            data: parsedData.data,
            searchQuery: parsedData.searchQuery,
            messageId: aiMessageId,
            searchUrl: searchUrl,
          }) + '\n',
        ),
      );

      sources = parsedData.data;
    }
  });

  stream.on('agent_action', (data) => {
    writer.write(
      encoder.encode(
        JSON.stringify({
          type: 'agent_action',
          data: data.data,
          messageId: userMessageId,
        }) + '\n',
      ),
    );
  });
  let modelStats: ModelStats = {
    modelName: '',
  };

  stream.on('progress', (data) => {
    const parsedData = JSON.parse(data);
    if (parsedData.type === 'progress') {
      writer.write(
        encoder.encode(
          JSON.stringify({
            type: 'progress',
            data: parsedData.data,
            messageId: aiMessageId,
          }) + '\n',
        ),
      );
    }
  });

  stream.on('stats', (data) => {
    const parsedData = JSON.parse(data);
    if (parsedData.type === 'modelStats') {
      modelStats = parsedData.data;
    }
  });

  stream.on('end', () => {
    isStreamActive = false;
    clearInterval(pingInterval);

    const endTime = Date.now();
    const duration = endTime - startTime;

    modelStats = {
      ...modelStats,
      responseTime: duration,
    };

    writer.write(
      encoder.encode(
        JSON.stringify({
          type: 'messageEnd',
          messageId: aiMessageId,
          modelStats: modelStats,
          searchQuery: searchQuery,
          searchUrl: searchUrl,
        }) + '\n',
      ),
    );
    writer.close();

    // Clean up the abort controller reference
    cleanupCancelToken(userMessageId);

    db.insert(messagesSchema)
      .values({
        content: recievedMessage,
        chatId: chatId,
        messageId: aiMessageId,
        role: 'assistant',
        metadata: JSON.stringify({
          createdAt: new Date(),
          ...(sources && sources.length > 0 && { sources }),
          ...(searchQuery && { searchQuery }),
          modelStats: modelStats,
          ...(searchUrl && { searchUrl }),
        }),
      })
      .execute();
  });
  stream.on('error', (data) => {
    isStreamActive = false;
    clearInterval(pingInterval);

    const parsedData = JSON.parse(data);
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
      .update(messagesSchema)
      .set({
        content: message.content,
        metadata: JSON.stringify({
          createdAt: new Date(),
        }),
      })
      .where(eq(messagesSchema.messageId, humanMessageId))
      .execute();
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
    const startTime = Date.now();
    const body = (await req.json()) as Body;
    const { message, selectedSystemPromptIds } = body;

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

    let llm: BaseChatModel | undefined;
    let embedding = embeddingModel.model;

    if (body.chatModel?.provider === 'custom_openai') {
      llm = new ChatOpenAI({
        openAIApiKey: getCustomOpenaiApiKey(),
        modelName: getCustomOpenaiModelName(),
        // temperature: 0.7,
        configuration: {
          baseURL: getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    } else if (chatModelProvider && chatModel) {
      llm = chatModel.model;

      // Set context window size for Ollama models
      if (llm instanceof ChatOllama && body.chatModel?.provider === 'ollama') {
        llm.numCtx = body.chatModel.ollamaContextWindow || 2048;
      }
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

    let systemInstructionsContent = '';
    let personaInstructionsContent = '';

    // Retrieve system prompts from database using shared utility
    const promptData = await getSystemPrompts(selectedSystemPromptIds);
    systemInstructionsContent = promptData.systemInstructions;
    personaInstructionsContent = promptData.personaInstructions;

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    // --- Cancellation logic ---
    const abortController = new AbortController();
    registerCancelToken(message.messageId, abortController);

    abortController.signal.addEventListener('abort', () => {
      console.log('Stream aborted, sending cancel event');
      writer.write(
        encoder.encode(
          JSON.stringify({
            type: 'error',
            data: 'Request cancelled by user',
          }),
        ),
      );
      cleanupCancelToken(message.messageId);
    });

    // Pass the abort signal to the search handler
    const stream = await handler.searchAndAnswer(
      message.content,
      history,
      llm,
      embedding,
      body.optimizationMode,
      body.files,
      systemInstructionsContent,
      abortController.signal,
      personaInstructionsContent,
    );

    handleEmitterEvents(
      stream,
      writer,
      encoder,
      aiMessageId,
      message.chatId,
      startTime,
      message.messageId,
      abortController,
    );

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
