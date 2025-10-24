import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import {
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '@/lib/providers';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '@/lib/config';
import { getSearchHandler, HandlerNames } from '@/lib/search';
import { isValidFocusMode } from '@/lib/validation';
import { baseSearchProviderManager } from '@/lib/search/searchProviders/manager';
import { z } from 'zod';

// Схема валидации для запроса
const externalApiSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  model: z
    .object({
      provider: z.string().optional(),
      name: z.string().optional(),
    })
    .optional()
    .default({}),
  searchProvider: z
    .enum(['searxng', 'exa', 'tavily', 'firecrawl', 'jina-ai'])
    .optional(),
  searchCount: z.number().min(1).max(50).optional().default(10),
  focusMode: z.string().min(1, 'Focus mode is required'),
  history: z
    .array(z.tuple([z.string(), z.string()]))
    .optional()
    .default([]),
  systemInstructions: z.string().optional().default(''),
  searchLanguage: z.string().optional().default(''),
});

type ExternalApiRequest = z.infer<typeof externalApiSchema>;

export const POST = async (req: Request) => {
  try {
    const body = await req.json();

    // Валидация запроса
    const validationResult = externalApiSchema.safeParse(body);
    if (!validationResult.success) {
      return Response.json(
        {
          message: 'Invalid request body',
          error: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const {
      query,
      model,
      searchProvider,
      searchCount,
      focusMode,
      history,
      systemInstructions,
      searchLanguage,
    } = validationResult.data;

    // Получение доступных моделей
    const [chatModelProviders, embeddingModelProviders] = await Promise.all([
      getAvailableChatModelProviders(),
      getAvailableEmbeddingModelProviders(),
    ]);

    // Выбор модели чата
    const chatModelProviderKey =
      model?.provider || Object.keys(chatModelProviders)[0];
    const chatModelName =
      model?.name ||
      Object.keys(chatModelProviders[chatModelProviderKey] || {})[0];

    if (
      !chatModelProviders[chatModelProviderKey] ||
      !chatModelProviders[chatModelProviderKey][chatModelName]
    ) {
      return Response.json(
        { message: 'Invalid chat model selected' },
        { status: 400 },
      );
    }

    // Выбор модели эмбеддингов
    const embeddingModelProviderKey = Object.keys(embeddingModelProviders)[0];
    const embeddingModelName = Object.keys(
      embeddingModelProviders[embeddingModelProviderKey] || {},
    )[0];

    if (
      !embeddingModelProviders[embeddingModelProviderKey] ||
      !embeddingModelProviders[embeddingModelProviderKey][embeddingModelName]
    ) {
      return Response.json(
        { message: 'Invalid embedding model selected' },
        { status: 400 },
      );
    }

    let llm: BaseChatModel | undefined;
    let embeddings: Embeddings | undefined;

    // Настройка кастомной OpenAI модели
    if (model?.provider === 'custom_openai') {
      llm = new ChatOpenAI({
        modelName: model?.name || getCustomOpenaiModelName(),
        apiKey: getCustomOpenaiApiKey(),
        temperature: 0.7,
        configuration: {
          baseURL: getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    } else {
      llm = chatModelProviders[chatModelProviderKey][chatModelName]
        .model as unknown as BaseChatModel;
    }

    embeddings = embeddingModelProviders[embeddingModelProviderKey][
      embeddingModelName
    ].model as Embeddings;

    if (!llm || !embeddings) {
      return Response.json(
        { message: 'Invalid model configuration' },
        { status: 400 },
      );
    }

    // Валидация режима фокуса
    if (!isValidFocusMode(focusMode)) {
      return Response.json({ message: 'Invalid focus mode' }, { status: 400 });
    }

    // Получение поискового обработчика
    const metaSearchAgent = getSearchHandler(
      focusMode as HandlerNames,
      llm,
      embeddings,
      searchLanguage,
    );

    if (!metaSearchAgent) {
      return Response.json({ message: 'Invalid focus mode' }, { status: 400 });
    }

    // Настройка поискового провайдера если указан
    if (searchProvider) {
      const searchProviderInstance =
        baseSearchProviderManager.getInstance(searchProvider);
      if (searchProviderInstance) {
        // Здесь можно настроить поисковый провайдер для мета-поиска
        // В текущей реализации мета-поиск использует свои настройки
        // Для полной интеграции потребуется модификация MetaSearchAgent
      }
    }

    // Преобразование истории
    const historyMessages: BaseMessage[] = history.map((msg) => {
      return msg[0] === 'human'
        ? new HumanMessage({ content: msg[1] })
        : new AIMessage({ content: msg[1] });
    });

    // Выполнение поиска и генерации ответа
    const emitter = await metaSearchAgent.searchAndAnswer(
      query,
      historyMessages,
      'balanced', // По умолчанию сбалансированный режим
      [],
      systemInstructions || '',
    );

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
              metadata: {
                model: {
                  provider: chatModelProviderKey,
                  name: chatModelName,
                },
                searchProvider: searchProvider || 'default',
                searchCount: searchCount,
                focusMode: focusMode,
              },
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
    console.error(`Error in external stream API: ${err.message}`);
    return Response.json(
      { message: 'An error has occurred.', error: err.message },
      { status: 500 },
    );
  }
};
