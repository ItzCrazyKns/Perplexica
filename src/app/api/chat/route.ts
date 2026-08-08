import { z } from 'zod';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import SearchAgent from '@/lib/agents/search';
import SessionManager from '@/lib/session';
import { ChatTurnMessage } from '@/lib/types';
import { SearchSources } from '@/lib/agents/search/types';
import { AuthorizedPage } from '@/lib/connectors/notion/types';
import {
  filterAuthorizedPages,
  NotionNotConnectedError,
} from '@/lib/connectors/notion';
import db from '@/lib/db';
import { eq } from 'drizzle-orm';
import { chats } from '@/lib/db/schema';
import UploadManager from '@/lib/uploads/manager';

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
  // sources / notionPages are optional WITHOUT a default: an omitted
  // field must not be confused with an explicit empty list (it would
  // wipe the chat's persisted selection on every message).
  sources: z.array(z.string()).optional(),
  history: z
    .array(z.tuple([z.string(), z.string()]))
    .optional()
    .default([]),
  files: z.array(z.string()).optional().default([]),
  notionPages: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        type: z.enum(['page', 'database']),
      }),
    )
    .optional(),
  chatModel: chatModelSchema,
  embeddingModel: embeddingModelSchema,
  systemInstructions: z.string().nullable().optional().default(''),
});

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

const ensureChatExists = async (input: {
  id: string;
  sources?: SearchSources[];
  query: string;
  fileIds: string[];
  notionPages?: AuthorizedPage[];
}) => {
  try {
    const exists = await db.query.chats
      .findFirst({
        where: eq(chats.id, input.id),
      })
      .execute();

    if (!exists) {
      await db.insert(chats).values({
        id: input.id,
        createdAt: new Date().toISOString(),
        sources: input.sources ?? [],
        title: input.query,
        files: input.fileIds.map((id) => {
          return {
            fileId: id,
            name: UploadManager.getFile(id)?.name || 'Uploaded File',
          };
        }),
        notionPages: input.notionPages ?? [],
      });
    } else {
      // Keep per-chat sources / Notion pages in sync — but only for
      // fields the request actually carried, so an omitted field never
      // wipes the persisted selection (e.g. a message sent before the
      // chat state has loaded).
      const update: Partial<typeof chats.$inferInsert> = {};
      if (input.sources !== undefined) update.sources = input.sources;
      if (input.notionPages !== undefined) {
        update.notionPages = input.notionPages;
      }

      if (Object.keys(update).length > 0) {
        await db
          .update(chats)
          .set(update)
          .where(eq(chats.id, input.id))
          .execute();
      }
    }
  } catch (err) {
    console.error('Failed to check/save chat:', err);
  }
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

    const sources = (body.sources ?? []) as SearchSources[];
    let notionPages = (body.notionPages ?? []) as AuthorizedPage[];

    // Server-side validation: only persist pages genuinely shared with
    // the OAuth connection (ADR-0001). Best-effort — on Notion API
    // errors we keep the caller's pages and let the agent tools re-verify
    // per read before touching the connector.
    if (notionPages.length > 0) {
      try {
        notionPages = await filterAuthorizedPages(db, notionPages);
      } catch (err) {
        if (err instanceof NotionNotConnectedError) {
          notionPages = [];
        } else {
          console.error('Failed to validate Notion pages:', err);
        }
      }
    }

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

    const disconnect = session.subscribe((event: string, data: any) => {
      if (event === 'data') {
        if (data.type === 'block') {
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
      } else if (event === 'end') {
        writer.write(
          encoder.encode(
            JSON.stringify({
              type: 'messageEnd',
            }) + '\n',
          ),
        );
        writer.close();
        session.removeAllListeners();
      } else if (event === 'error') {
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
      }
    });

    agent
      .searchAsync(session, {
        chatHistory: history,
        followUp: message.content,
        chatId: body.message.chatId,
        messageId: body.message.messageId,
        config: {
          llm,
          embedding: embedding,
          sources,
          mode: body.optimizationMode,
          fileIds: body.files,
          systemInstructions: body.systemInstructions || 'None',
          notionPages,
        },
      })
      .catch((err: unknown) => {
        // Fire-and-forget by design: without this, an early failure in the
        // agent (classify, db, LLM) leaves the response stream open forever
        // and the UI stuck on "answering" with no content.
        console.error('Agent search failed:', err);
        session.emit('error', {
          data: 'Something went wrong while processing your request. Please try again.',
        });
      });

    ensureChatExists({
      id: body.message.chatId,
      sources,
      fileIds: body.files,
      query: body.message.content,
      notionPages,
    });

    req.signal.addEventListener('abort', () => {
      disconnect();
      writer.close();
    });

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
