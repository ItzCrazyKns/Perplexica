import express from 'express';
import logger from '../utils/logger';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getAvailableChatModelProviders } from '../lib/providers';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '../config';

const router = express.Router();

interface TranslateBody {
  text: string;
  targetLanguage: string;
}

router.post('/', async (req, res) => {
  try {
    const body: TranslateBody = req.body;
    if (!body.text || !body.targetLanguage) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const chatModelProviders = await getAvailableChatModelProviders();
    const provider = Object.keys(chatModelProviders)[0];
    const model = Object.keys(chatModelProviders[provider])[0];
    let llm: BaseChatModel | undefined;
    
    if (provider === 'custom_openai') {
      llm = new ChatOpenAI({
        modelName: getCustomOpenaiModelName(),
        openAIApiKey: getCustomOpenaiApiKey(),
        configuration: {
          baseURL: getCustomOpenaiApiUrl(),
        },
      }) as unknown as BaseChatModel;
    } else {
      llm = chatModelProviders[provider][model].model as unknown as BaseChatModel;
    }

    if (!llm) {
      return res.status(400).json({ message: 'No LLM model available' });
    }

    const prompt = `Translate the following text to ${body.targetLanguage}. Maintain the exact same formatting, including any markdown or special characters:
${body.text}`;

    const response = await llm.invoke([new HumanMessage(prompt)]);
    
    res.status(200).json({ translatedText: response.content });
  } catch (err: any) {
    logger.error(`Error in translation: ${err.message}`);
    res.status(500).json({ message: 'An error has occurred.' });
  }
});

export default router;