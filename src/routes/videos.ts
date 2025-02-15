import express from 'express';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getAvailableChatModelProviders } from '../lib/providers';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import logger from '../utils/logger';
import handleVideoSearch from '../chains/videoSearchAgent';
import { ChatOpenAI } from '@langchain/openai';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '../config';
import { ChatOllama } from '@langchain/community/chat_models/ollama';

const router = express.Router();

interface ChatModel {
  provider: string;
  model: string;
  ollamaContextWindow?: number;
}

interface VideoSearchBody {
  query: string;
  chatHistory: any[];
  chatModel?: ChatModel;
}

router.post('/', async (req, res) => {
  try {
    let body: VideoSearchBody = req.body;

    const chatHistory = body.chatHistory.map((msg: any) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      }
    });

    const chatModelProviders = await getAvailableChatModelProviders();

    const chatModelProvider =
      body.chatModel?.provider || Object.keys(chatModelProviders)[0];
    const chatModel =
      body.chatModel?.model ||
      Object.keys(chatModelProviders[chatModelProvider])[0];

    let llm: BaseChatModel | undefined;

    if (body.chatModel?.provider === 'custom_openai') {
      llm = new ChatOpenAI({
        modelName: getCustomOpenaiModelName(),
        openAIApiKey: getCustomOpenaiApiKey(),
        temperature: 0.7,
        configuration: {
          baseURL: getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    } else if (
      chatModelProviders[chatModelProvider] &&
      chatModelProviders[chatModelProvider][chatModel]
    ) {
      llm = chatModelProviders[chatModelProvider][chatModel]
        .model as unknown as BaseChatModel | undefined;
      
      if (llm instanceof ChatOllama) {
        llm.numCtx = body.chatModel?.ollamaContextWindow || 2048;
      }
    }

    if (!llm) {
      return res.status(400).json({ message: 'Invalid model selected' });
    }

    const videos = await handleVideoSearch(
      { chat_history: chatHistory, query: body.query },
      llm,
    );

    res.status(200).json({ videos });
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
    logger.error(`Error in video search: ${err.message}`);
  }
});

export default router;
