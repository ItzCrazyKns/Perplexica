import crypto from 'crypto';
import { z } from 'zod';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import SearchAgent from '@/lib/agents/search';
import SessionManager from '@/lib/session';
import { ChatTurnMessage } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
  content: z.string().min(1, 'Message content is required'),
});

const chatModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({ message: 'Chat model provider id must be provided' }),
  key: z.string({ message: 'Chat model key must be provided' }),
});

const embeddingModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({
    message: 'Embedding model provider id must be provided',
  }),
  key: z.string({ message: 'Embedding model key must be provided' }),
});

const bodySchema = z.object({
  message: messageSchema,
  optimizationMode: z.enum(['speed', 'balanced', 'quality'], {
    message: 'Optimization mode must be one of: speed, balanced, quality',
  }),
  focusMode: z.string().min(1, 'Focus mode is required'),
  history: z
    .array(z.tuple([z.string(), z.string()]))
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
      error: result.error.issues.map((e: any) => ({
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

export const POST = async (req: Request) => {
  try {
    const reqBody = (await req.json()) as Body;

    const parseBody = safeValidateBody(reqBody);

    if (!parseBody.success) {
      return Response.json(
        { message: 'Invalid request body', error: parseBody.error },
        { status: 400 },
      );
    }

    const body = parseBody.data as Body;
    const { message } = body;

    if (message.content === '') {
      return Response.json(
        {
          message: 'Please provide a message to process',
        },
        { status: 400 },
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

    const history: ChatTurnMessage[] = body.history.map((msg) => {
      if (msg[0] === 'human') {
        return {
          role: 'user',
          content: msg[1],
        };
      } else {
        return {
          role: 'assistant',
          content: msg[1],
        };
      }
    });

    const agent = new SearchAgent();
    const session = SessionManager.createSession();

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    let receivedMessage = '';

    session.addListener('data', (data: any) => {
      if (data.type === 'response') {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'message',
              data: data.data,
            }) + '\n',
          ),
        );
        receivedMessage += data.data;
      } else if (data.type === 'sources') {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'sources',
              data: data.data,
            }) + '\n',
          ),
        );
      } else if (data.type === 'block') {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'block',
              block: data.block,
            }) + '\n',
          ),
        );
      } else if (data.type === 'updateBlock') {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'updateBlock',
              blockId: data.blockId,
              patch: data.patch,
            }) + '\n',
          ),
        );
      } else if (data.type === 'researchComplete') {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'researchComplete',
            }) + '\n',
          ),
        );
      }
    });

    session.addListener('end', () => {
      writer.write(
        encoder.encode(
          JSON.stringify({
            type: 'messageEnd',
          }) + '\n',
        ),
      );
      writer.close();
      session.removeAllListeners();
    });

    session.addListener('error', (data: any) => {
      writer.write(
        encoder.encode(
          JSON.stringify({
            type: 'error',
            data: data.data,
          }) + '\n',
        ),
      );
      writer.close();
      session.removeAllListeners();
    });

    agent.searchAsync(session, {
      chatHistory: history,
      followUp: message.content,
      config: {
        llm,
        embedding: embedding,
        sources: ['web'],
        mode: body.optimizationMode,
      },
    });

    /*  handleHistorySave(message, humanMessageId, body.focusMode, body.files); */

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
