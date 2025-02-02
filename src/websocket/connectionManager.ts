import { WebSocket } from 'ws';
import { handleMessage } from './messageHandler';
import {
  getAvailableEmbeddingModelProviders,
  getAvailableChatModelProviders,
} from '../lib/providers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import type { IncomingMessage } from 'http';
import logger from '../utils/logger';
import { ChatOpenAI } from '@langchain/openai';

export const handleConnection = async (
  ws: WebSocket,
  request: IncomingMessage,
) => {
  try {
    logger.info(`🔗 New WebSocket connection from ${request.socket.remoteAddress}`);

    const searchParams = new URL(request.url, `http://${request.headers.host}`)
      .searchParams;

    const [chatModelProviders, embeddingModelProviders] = await Promise.all([
      getAvailableChatModelProviders(),
      getAvailableEmbeddingModelProviders(),
    ]);

    // Retrieve query parameters
    const chatModelProvider =
      searchParams.get('chatModelProvider') ||
      Object.keys(chatModelProviders)[0];

    const chatModel =
      searchParams.get('chatModel') ||
      Object.keys(chatModelProviders[chatModelProvider])[0];

    const embeddingModelProvider =
      searchParams.get('embeddingModelProvider') ||
      Object.keys(embeddingModelProviders)[0];

    const embeddingModel =
      searchParams.get('embeddingModel') ||
      Object.keys(embeddingModelProviders[embeddingModelProvider])[0];

    logger.debug(
      `📜 WebSocket Connection - Model Selection:
       🔹 Chat Model Provider: ${chatModelProvider}
       🔹 Chat Model: ${chatModel}
       🔹 Embedding Model Provider: ${embeddingModelProvider}
       🔹 Embedding Model: ${embeddingModel}`
    );

    let llm: BaseChatModel | undefined;
    let embeddings: Embeddings | undefined;

    // Handle model selection
    if (
      chatModelProviders[chatModelProvider] &&
      chatModelProviders[chatModelProvider][chatModel] &&
      chatModelProvider !== 'custom_openai'
    ) {
      llm = chatModelProviders[chatModelProvider][chatModel]
        .model as unknown as BaseChatModel | undefined;
    } else if (chatModelProvider === 'custom_openai') {
      logger.info(`🛠 Using custom OpenAI model: ${chatModel}`);
      llm = new ChatOpenAI({
        modelName: chatModel,
        openAIApiKey: searchParams.get('openAIApiKey'),
        temperature: 0.7,
        configuration: {
          baseURL: searchParams.get('openAIBaseURL'),
        },
      }) as unknown as BaseChatModel;
    }

    if (
      embeddingModelProviders[embeddingModelProvider] &&
      embeddingModelProviders[embeddingModelProvider][embeddingModel]
    ) {
      embeddings = embeddingModelProviders[embeddingModelProvider][embeddingModel]
        .model as Embeddings | undefined;
    }

    if (!llm || !embeddings) {
      logger.error(`❌ Invalid LLM or embeddings model selection!`);
      ws.send(
        JSON.stringify({
          type: 'error',
          data: 'Invalid LLM or embeddings model selected, please refresh the page and try again.',
          key: 'INVALID_MODEL_SELECTED',
        }),
      );
      ws.close();
      return;
    }

    logger.info(`✅ WebSocket setup complete - Ready for messages`);

    // Send an initial "open" signal once connection is ready
    const interval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        logger.debug(`📡 Sending initial 'open' signal to client`);
        ws.send(
          JSON.stringify({
            type: 'signal',
            data: 'open',
          }),
        );
        clearInterval(interval);
      }
    }, 5);

    // Handle incoming messages
    ws.on('message', async (message) => {
      logger.info(`📩 Received message from client: ${message.toString()}`);
      await handleMessage(message.toString(), ws, llm, embeddings);
    });

    // Handle WebSocket closure
    ws.on('close', () => {
      logger.warn(`❌ WebSocket connection closed for ${request.socket.remoteAddress}`);
    });

  } catch (err) {
    logger.error(`❌ WebSocket error: ${err.message}`);
    ws.send(
      JSON.stringify({
        type: 'error',
        data: 'Internal server error.',
        key: 'INTERNAL_SERVER_ERROR',
      }),
    );
    ws.close();
  }
};
