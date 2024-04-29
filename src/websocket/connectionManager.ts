import { WebSocket } from 'ws';
import { handleMessage } from './messageHandler';
import { getChatModel, getChatModelProvider } from '../config';
import { getAvailableProviders } from '../lib/providers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';

export const handleConnection = async (ws: WebSocket) => {
  try {
    const models = await getAvailableProviders();
    const provider = getChatModelProvider();
    const chatModel = getChatModel();

    let llm: BaseChatModel | undefined;
    let embeddings: Embeddings | undefined;

    if (models[provider] && models[provider][chatModel]) {
      llm = models[provider][chatModel] as BaseChatModel | undefined;
      embeddings = models[provider].embeddings as Embeddings | undefined;
    }

    // Separate checks for llm and embeddings
    if (!llm && !embeddings) {
      ws.send(
        JSON.stringify({
          type: 'error',
          data: 'Invalid LLM and embeddings model selected',
        }),
      );
      console.error('Invalid LLM and embeddings model selected');
    } else if (!llm) {
      ws.send(
        JSON.stringify({
          type: 'error',
          data: 'Invalid LLM model selected',
        }),
      );
      console.error('Invalid LLM model selected');
    } else if (!embeddings) {
      ws.send(
        JSON.stringify({
          type: 'error',
          data: 'Invalid embeddings model selected',
        }),
      );
      console.error('Invalid embeddings model selected');
    }

    if (!llm || !embeddings) {
      ws.close();
      return;
    }

    ws.on('message', async (message) => {
      try {
        await handleMessage(message.toString(), ws, llm, embeddings);
      } catch (error) {
        console.error('Error handling message:', error);
        ws.send(
          JSON.stringify({
            type: 'error',
            data: 'Error processing your message',
          }),
        );
      }
    });

    ws.on('close', () => console.log('Connection closed'));
  } catch (error) {
    console.error('Failed to establish a connection:', error);
    ws.send(
      JSON.stringify({
        type: 'error',
        data: 'Failed to establish a connection',
      }),
    );
    ws.close();
  }
};
