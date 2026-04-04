import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import { ChatOpenAI } from '@langchain/openai';
import {
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '@/lib/providers';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { MetaSearchAgentType } from '@/lib/search/metaSearchAgent';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '@/lib/config';
import { searchHandlers } from '@/lib/search';

interface chatModel {
  provider: string;
  name: string;
  customOpenAIKey?: string;
  customOpenAIBaseURL?: string;
}

interface embeddingModel {
  provider: string;
  name: string;
}

interface ChatRequestBody {
  optimizationMode: 'speed' | 'balanced';
  focusMode: string;
  chatModel?: chatModel;
  embeddingModel?: embeddingModel;
  query: string;
  history: Array<[string, string]>;
  stream?: boolean;
  systemInstructions?: string;
  responsePrompt?: string;
  retrieverPrompt?: string;
  restrictToSites?: string[];
  searchEngineCx?: string;
  synthesize?: boolean;
}

export const POST = async (req: Request) => {
  try {
    const body: ChatRequestBody = await req.json();

    if (!body.focusMode || !body.query) {
      return Response.json(
        { message: 'Missing focus mode or query' },
        { status: 400 },
      );
    }

    body.history = body.history || [];
    body.optimizationMode = body.optimizationMode || 'balanced';
    body.stream = body.stream || false;

    const history: BaseMessage[] = body.history.map((msg) => {
      return msg[0] === 'human'
        ? new HumanMessage({ content: msg[1] })
        : new AIMessage({ content: msg[1] });
    });

    const [chatModelProviders, embeddingModelProviders] = await Promise.all([
      getAvailableChatModelProviders(),
      getAvailableEmbeddingModelProviders(),
    ]);

    const chatModelProvider =
      body.chatModel?.provider || Object.keys(chatModelProviders)[0];
    const chatModel =
      body.chatModel?.name ||
      Object.keys(chatModelProviders[chatModelProvider])[0];

    const embeddingModelProvider =
      body.embeddingModel?.provider || Object.keys(embeddingModelProviders)[0];
    const embeddingModel =
      body.embeddingModel?.name ||
      Object.keys(embeddingModelProviders[embeddingModelProvider])[0];

    let llm: BaseChatModel | undefined;
    let embeddings: Embeddings | undefined;

    if (body.chatModel?.provider === 'custom_openai') {
      llm = new ChatOpenAI({
        modelName: body.chatModel?.name || getCustomOpenaiModelName(),
        apiKey: body.chatModel?.customOpenAIKey || getCustomOpenaiApiKey(),
        temperature: 0.7,
        configuration: {
          baseURL:
            body.chatModel?.customOpenAIBaseURL || getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    } else if (
      chatModelProviders[chatModelProvider] &&
      chatModelProviders[chatModelProvider][chatModel]
    ) {
      llm = chatModelProviders[chatModelProvider][chatModel]
        .model as unknown as BaseChatModel | undefined;
    }

    if (
      embeddingModelProviders[embeddingModelProvider] &&
      embeddingModelProviders[embeddingModelProvider][embeddingModel]
    ) {
      embeddings = embeddingModelProviders[embeddingModelProvider][
        embeddingModel
      ].model as Embeddings | undefined;
    }

    if (!llm || !embeddings) {
      return Response.json(
        { message: 'Invalid model selected' },
        { status: 400 },
      );
    }

    const searchHandler: MetaSearchAgentType = searchHandlers[body.focusMode];

    if (!searchHandler) {
      return Response.json({ message: 'Invalid focus mode' }, { status: 400 });
    }

    // Validate and normalize response prompt
    let normalizedResponsePrompt = body.responsePrompt;
    if (body.responsePrompt) {
      const trimmed = body.responsePrompt.trim();
      if (trimmed.length === 0) {
        console.log(
          `❌ [Prompt] Custom response prompt provided but is empty/whitespace only - will use default prompt`,
        );
        normalizedResponsePrompt = undefined;
      } else {
        normalizedResponsePrompt = trimmed;
        const promptPreview = normalizedResponsePrompt.substring(0, 200);
        console.log(
          `[Prompt] Custom response prompt provided (first 200 chars): ${promptPreview}${normalizedResponsePrompt.length > 200 ? '...' : ''}`,
        );
      }
    }
    
    // Validate and normalize retriever prompt
    let normalizedRetrieverPrompt = body.retrieverPrompt;
    if (body.retrieverPrompt) {
      const trimmed = body.retrieverPrompt.trim();
      if (trimmed.length === 0) {
        console.log(
          `❌ [Prompt] Custom retriever prompt provided but is empty/whitespace only - will use default prompt`,
        );
        normalizedRetrieverPrompt = undefined;
      } else {
        normalizedRetrieverPrompt = trimmed;
        const retrieverPromptPreview = normalizedRetrieverPrompt.substring(0, 200);
        console.log(
          `[Prompt] Custom retriever prompt provided (first 200 chars): ${retrieverPromptPreview}${normalizedRetrieverPrompt.length > 200 ? '...' : ''}`,
        );
      }
    }
    if (body.restrictToSites && body.restrictToSites.length > 0) {
      console.log(
        `[Site Restriction] restrictToSites: ${JSON.stringify(body.restrictToSites)}`,
      );
    }

    const { emitter, promptUsed } = await searchHandler.searchAndAnswer(
      body.query,
      history,
      llm,
      embeddings,
      body.optimizationMode,
      [],
      body.systemInstructions || '',
      normalizedResponsePrompt,
      normalizedRetrieverPrompt,
      body.restrictToSites,
      body.searchEngineCx,
      body.synthesize,
    );

    if (!body.stream) {
      return new Promise(
        (
          resolve: (value: Response) => void,
          reject: (value: Response) => void,
        ) => {
          let message = '';
          let sources: any[] = [];

          emitter.on('data', (data: string) => {
            try {
              const parsedData = JSON.parse(data);
              if (parsedData.type === 'response') {
                message += parsedData.data;
              } else if (parsedData.type === 'sources') {
                console.log('[Search Route] Sources received:', JSON.stringify(parsedData.data, null, 2).substring(0, 500));
                console.log('[Search Route] Sources type:', typeof parsedData.data);
                console.log('[Search Route] Sources is array:', Array.isArray(parsedData.data));
                console.log('[Search Route] Sources length:', parsedData.data?.length || 0);
                sources = parsedData.data;
              }
            } catch (error) {
              console.error('❌ [Search Route] Error parsing data:', error);
              console.error('❌ [Search Route] Data that failed:', data);
              reject(
                Response.json(
                  { message: 'Error parsing data' },
                  { status: 500 },
                ),
              );
            }
          });

          emitter.on('end', () => {
            console.log('[Search Route] Stream ended');
            console.log('[Search Route] Final message length:', message.length);
            console.log('[Search Route] Final sources:', JSON.stringify(sources, null, 2).substring(0, 500));
            console.log('[Search Route] Final sources count:', sources?.length || 0);
            resolve(
              Response.json({ message, sources, promptUsed }, { status: 200 }),
            );
          });

          emitter.on('error', (error: any) => {
            reject(
              Response.json(
                { message: 'Search error', error },
                { status: 500 },
              ),
            );
          });
        },
      );
    }

    const encoder = new TextEncoder();

    const abortController = new AbortController();
    const { signal } = abortController;

    const stream = new ReadableStream({
      start(controller) {
        let sources: any[] = [];

        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: 'init',
              data: 'Stream connected',
            }) + '\n',
          ),
        );

        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: 'promptUsed',
              data: promptUsed,
            }) + '\n',
          ),
        );

        signal.addEventListener('abort', () => {
          emitter.removeAllListeners();

          try {
            controller.close();
          } catch (error) {}
        });

        emitter.on('data', (data: string) => {
          if (signal.aborted) return;

          try {
            const parsedData = JSON.parse(data);

            if (parsedData.type === 'response') {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: 'response',
                    data: parsedData.data,
                  }) + '\n',
                ),
              );
            } else if (parsedData.type === 'sources') {
              sources = parsedData.data;
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: 'sources',
                    data: sources,
                  }) + '\n',
                ),
              );
            }
          } catch (error) {
            controller.error(error);
          }
        });

        emitter.on('end', () => {
          if (signal.aborted) return;

          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: 'done',
              }) + '\n',
            ),
          );
          controller.close();
        });

        emitter.on('error', (error: any) => {
          if (signal.aborted) return;

          controller.error(error);
        });
      },
      cancel() {
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
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
