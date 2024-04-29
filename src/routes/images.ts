import express from 'express';
import handleImageSearch from '../agents/imageSearchAgent';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getAvailableProviders } from '../lib/providers';
import { getChatModel, getChatModelProvider } from '../config';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    let { query, chat_history } = req.body;

    console.log('Received request with query:', query);

    chat_history = chat_history.map((msg: any) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      }
    });

    console.log('Processed chat history:', chat_history);

    const models = await getAvailableProviders();
    const provider = getChatModelProvider();
    const chatModel = getChatModel();

    console.log(`Using provider: ${provider} and model: ${chatModel}`);

    let llm: BaseChatModel | undefined;

    if (models[provider] && models[provider][chatModel]) {
      llm = models[provider][chatModel] as BaseChatModel | undefined;
    }

    if (!llm) {
      console.error('Invalid LLM model selected');
      res.status(500).json({ message: 'Invalid LLM model selected' });
      return;
    }

    try {
      const images = await handleImageSearch({ query, chat_history }, llm);
      res.status(200).json({ images });
      console.log('Image search successful:', images);
    } catch (error) {
      console.error('Error during image search:', error);
      res.status(500).json({ message: 'Error during image search' });
    }
  } catch (err) {
    console.error('An error occurred in the main request handler:', err);
    res.status(500).json({ message: 'An error has occurred.' });
  }
});

export default router;
