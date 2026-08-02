import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import SessionManager from '@/lib/session';
import { ChatTurnMessage } from '@/lib/types';
import { SearchSources } from '@/lib/agents/search/types';
import SearchAgent from '@/lib/agents/search';

interface ChatRequestBody {
  optimizationMode: 'speed' | 'balanced' | 'quality';
  sources: SearchSources[];
  chatModel: ModelWithProvider;
  embeddingModel: ModelWithProvider;
  query: string;
  history: Array<[string, string]>;
  stream?: boolean;
  systemInstructions?: string;
}

/*
 * Adapts the internal block protocol to this endpoint's documented
 * wire format (response deltas, sources, done). Replaces the drifted
 * APISearchAgent copy: same pipeline as chat, persist: false.
 */
const subscribeForApi = (
  session: SessionManager,
  handlers: {
    onDelta: (delta: string) => void;
    onSources: (sources: any[]) => void;
    onEnd: () => void;
    onError: (data: any) => void;
  },
): (() => void) =>
  session.subscribe((event: string, data: any) => {
    if (event === 'data') {
      if (data.type === 'block' && data.block.type === 'text') {
        handlers.onDelta(data.block.data);
      } else if (data.type === 'appendText') {
        handlers.onDelta(data.delta);
      } else if (data.type === 'block' && data.block.type === 'source') {
        handlers.onSources(data.block.data);
      }
    } else if (event === 'end') {
      handlers.onEnd();
    } else if (event === 'error') {
      handlers.onError(data);
    }
  });

export const POST = async (req: Request) => {
  try {
    const body: ChatRequestBody = await req.json();

    if (!body.sources || !body.query) {
      return Response.json(
        { message: 'Missing sources or query' },
        { status: 400 },
      );
    }

    body.history = body.history || [];
    body.optimizationMode = body.optimizationMode || 'speed';
    body.stream = body.stream || false;

    const registry = ModelRegistry.getInstance();

    const [llm, embeddings] = await Promise.all([
      registry.loadChatModel(body.chatModel.providerId, body.chatModel.key),
      registry.loadEmbeddingModel(
        body.embeddingModel.providerId,
        body.embeddingModel.key,
      ),
    ]);

    const history: ChatTurnMessage[] = body.history.map((msg) => {
      return msg[0] === 'human'
        ? { role: 'user', content: msg[1] }
        : { role: 'assistant', content: msg[1] };
    });

    const session = SessionManager.createSession();

    const agent = new SearchAgent();

    agent.searchAsync(session, {
      chatHistory: history,
      config: {
        embedding: embeddings,
        llm: llm,
        sources: body.sources,
        mode: body.optimizationMode,
        fileIds: [],
        systemInstructions: body.systemInstructions || '',
      },
      followUp: body.query,
      chatId: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
      persist: false,
    });

    if (!body.stream) {
      return new Promise((resolve: (value: Response) => void) => {
        let message = '';
        let sources: any[] = [];

        const disconnect = subscribeForApi(session, {
          onDelta: (delta) => {
            message += delta;
          },
          onSources: (s) => {
            sources = s;
          },
          onEnd: () => {
            disconnect();
            resolve(Response.json({ message, sources }, { status: 200 }));
          },
          onError: (data) => {
            disconnect();
            resolve(
              Response.json(
                { message: 'Search error', error: data },
                { status: 500 },
              ),
            );
          },
        });
      });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let closed = false;
        let disconnect = () => {};

        const close = () => {
          if (closed) return;
          closed = true;
          disconnect();
          try {
            controller.close();
          } catch {}
        };

        const enqueue = (payload: unknown) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(JSON.stringify(payload) + '\n'));
          } catch {
            close();
          }
        };

        enqueue({ type: 'init', data: 'Stream connected' });

        disconnect = subscribeForApi(session, {
          onDelta: (delta) => enqueue({ type: 'response', data: delta }),
          onSources: (sources) => enqueue({ type: 'sources', data: sources }),
          onEnd: () => {
            enqueue({ type: 'done' });
            close();
          },
          onError: (data) => {
            enqueue({ type: 'error', data });
            close();
          },
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error(`Error in getting search results: ${err.message}`);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
