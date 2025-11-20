import crypto from 'crypto';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { EventEmitter } from 'stream';
import db from '@/lib/db';
import { chats, messages as messagesSchema } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { getFileDetails } from '@/lib/utils/files';
import { searchHandlers } from '@/lib/search';
import { z } from 'zod';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
  content: z.string().min(1, 'Message content is required'),
});

const chatModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({
    errorMap: () => ({
      message: 'Chat model provider id must be provided',
    }),
  }),
  key: z.string({
    errorMap: () => ({
      message: 'Chat model key must be provided',
    }),
  }),
});

const embeddingModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({
    errorMap: () => ({
      message: 'Embedding model provider id must be provided',
    }),
  }),
  key: z.string({
    errorMap: () => ({
      message: 'Embedding model key must be provided',
    }),
  }),
});

const bodySchema = z.object({
  message: messageSchema,
  optimizationMode: z.enum(['speed', 'balanced', 'quality'], {
    errorMap: () => ({
      message: 'Optimization mode must be one of: speed, balanced, quality',
    }),
  }),
  focusMode: z.string().min(1, 'Focus mode is required'),
  history: z
    .array(
      z.tuple([z.string(), z.string()], {
        errorMap: () => ({
          message: 'History items must be tuples of two strings',
        }),
      }),
    )
    .optional()
    .default([]),
  files: z.array(z.string()).optional().default([]),
  chatModel: chatModelSchema,
  embeddingModel: embeddingModelSchema,
  systemInstructions: z.string().nullable().optional().default(''),
});

type Message = z.infer<typeof messageSchema>;
type Body = z.infer<typeof bodySchema>;

const safeValidateBody = (data: unknown) => {
  const result = bodySchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }

  return {
    success: true,
    data: result.data,
  };
};

interface SourceMessage {
  id: string;
  data: any;
  date: string;
}

interface CollectedData {
  message: string;
  sources: SourceMessage[];
  aiMessageId: string;
}

interface AgentResult {
  originalMessage: string;
  totalSources: number;
  removedSources: number;
  verifiedSources: SourceMessage[];
  maliciousSources: SourceMessage[];
}

const handleEmitterEvents = async (
  stream: EventEmitter,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  chatId: string,
) => {
  const collectedData: CollectedData = {
    message: '',
    sources: [],
    aiMessageId: crypto.randomBytes(7).toString('hex'),
  };

  stream.on('data', (data) => {
    const parsedData = JSON.parse(data);

    if (parsedData.type === 'response') {
      collectedData.message += parsedData.data;
    } else if (parsedData.type === 'sources') {
      const sourceMessage: SourceMessage = {
        id: crypto.randomBytes(7).toString('hex'),
        data: parsedData.data,
        date: new Date().toString(),
      };
      collectedData.sources.push(sourceMessage);
    }
  });

  stream.on('end', async () => {
    try {
      // Process message with agent
      const agentResult = await processWithAgent(
        collectedData.message,
        collectedData.sources,
      );
      // Write verified sources
      await writeVerifiedSources(
        writer,
        encoder,
        agentResult.verifiedSources,
        collectedData.aiMessageId,
        chatId,
      );
      // Modify response as needed based on agent result
      await writeResponseWithStatus(
        writer,
        encoder,
        agentResult,
        collectedData.aiMessageId,
        chatId,
      );
    } catch (error) {
      await handleAgentError(writer, encoder, error);
    }
  });
  stream.on('error', (data) => {
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

async function processWithAgent(
  message: string,
  sources: SourceMessage[],
): Promise<AgentResult> {
  try {
    const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL;

    const response = await fetch(`${AGENT_SERVICE_URL}/echo/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        sources: sources,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent service returned ${response.status}`);
    }

    const agentResult: AgentResult = await response.json();
    return agentResult;
  } catch (error) {
    // TODO
    console.error('Error calling agent service: ', error);
    const errorStatus =
      'The agent failed to verify the sources for this response:\n\n';
    const errorMessage = errorStatus + message;

    return {
      originalMessage: errorMessage,
      totalSources: sources.length,
      removedSources: 0,
      verifiedSources: sources,
      maliciousSources: [],
    };
  }
}

async function writeVerifiedSources(
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  sources: SourceMessage[],
  messageId: string,
  chatId: string,
) {
  for (const source of sources) {
    writer.write(
      encoder.encode(
        JSON.stringify({
          type: 'sources',
          data: source.data,
          messageId: messageId,
        }) + '\n',
      ),
    );

    db.insert(messagesSchema)
      .values({
        chatId: chatId,
        messageId: source.id,
        role: 'source',
        sources: source.data,
        createdAt: source.date,
      })
      .execute();
  }
}

async function writeResponseWithStatus(
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  agentResult: AgentResult,
  messageId: string,
  chatId: string,
) {
  let statusMessage = '';
  let finalMessage = agentResult.originalMessage;

  if (agentResult.removedSources === 0) {
    statusMessage =
      'No malicious sources encountered for the following message:\n\n';
  } else if (agentResult.removedSources < agentResult.totalSources) {
    statusMessage = `Some malicious sources were removed from this message (${agentResult.removedSources}/${agentResult.totalSources} removed):\n\n`;
    // TODO: request rewrite from model with verified sources only
  } else {
    statusMessage =
      'Non-malicious online sources were not available for this query.\n\n';
    // TODO: request rewrite without sources
  }

  const fullResponse = statusMessage + finalMessage;

  writer.write(
    encoder.encode(
      JSON.stringify({
        type: 'message',
        data: fullResponse,
        messageId: messageId,
      }) + '\n',
    ),
  );

  writer.write(
    encoder.encode(
      JSON.stringify({
        type: 'messageEnd',
        messageId: messageId,
      }) + '\n',
    ),
  );

  db.insert(messagesSchema)
    .values({
      content: fullResponse,
      chatId: chatId,
      messageId: messageId,
      role: 'assistant',
      createdAt: new Date().toString(),
    })
    .execute();

  writer.close();
}

async function handleAgentError(
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  error: any,
) {
  console.error('Agent processing error:', error);

  writer.write(
    encoder.encode(
      JSON.stringify({
        type: 'error',
        data: 'An error occurred while verifying sources. Please try again.',
      }) + '\n',
    ),
  );

  writer.close();
}

const handleHistorySave = async (
  message: Message,
  humanMessageId: string,
  focusMode: string,
  files: string[],
) => {
  const chat = await db.query.chats.findFirst({
    where: eq(chats.id, message.chatId),
  });

  const fileData = files.map(getFileDetails);

  if (!chat) {
    await db
      .insert(chats)
      .values({
        id: message.chatId,
        title: message.content,
        createdAt: new Date().toString(),
        focusMode: focusMode,
        files: fileData,
      })
      .execute();
  } else if (JSON.stringify(chat.files ?? []) != JSON.stringify(fileData)) {
    db.update(chats)
      .set({
        files: files.map(getFileDetails),
      })
      .where(eq(chats.id, message.chatId));
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
        createdAt: new Date().toString(),
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
    const reqBody = (await req.json()) as Body;

    const parseBody = safeValidateBody(reqBody);
    if (!parseBody.success) {
      return Response.json(
        {
          message: 'Invalid request body',
          error: parseBody.error,
        },
        {
          status: 400,
        },
      );
    }

    const body = parseBody.data as Body;
    const { message } = body;

    if (message.content === '') {
      return Response.json(
        {
          message: 'Please provide a message to process',
        },
        {
          status: 400,
        },
      );
    }

    const registry = new ModelRegistry();

    const [llm, embedding] = await Promise.all([
      registry.loadChatModel(body.chatModel.providerId, body.chatModel.key),
      registry.loadEmbeddingModel(
        body.embeddingModel.providerId,
        body.embeddingModel.key,
      ),
    ]);

    const humanMessageId =
      message.messageId ?? crypto.randomBytes(7).toString('hex');

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
        {
          status: 400,
        },
      );
    }

    const stream = await handler.searchAndAnswer(
      message.content,
      history,
      llm,
      embedding,
      body.optimizationMode,
      body.files,
      body.systemInstructions as string,
    );

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    handleEmitterEvents(stream, writer, encoder, message.chatId);
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
      {
        message: 'An error occurred while processing chat request',
      },
      {
        status: 500,
      },
    );
  }
};
