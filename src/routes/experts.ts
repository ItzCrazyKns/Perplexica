import express from 'express';
import handleExpertSearch from '../chains/expertSearchAgent';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getAvailableChatModelProviders } from '../lib/providers';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import logger from '../utils/logger';
import { ChatOpenAI } from '@langchain/openai';
import { ExpertSearchRequest } from '../types/types';
import crypto from 'crypto';

const router = express.Router();

interface ChatModel {
  provider: string;
  model: string;
  customOpenAIBaseURL?: string;
  customOpenAIKey?: string;
}

interface ExpertSearchBody {
  query: string;
  chatHistory: any[];
  chatModel?: ChatModel;
}

router.post('/', async (req, res) => {
  try {
    const body: ExpertSearchBody = req.body;

    // Conversion de l'historique du chat
    const chatHistory = body.chatHistory.map((msg: any) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      }
    });

    // Configuration du modèle LLM
    const chatModelProviders = await getAvailableChatModelProviders();

    const chatModelProvider =
      body.chatModel?.provider || Object.keys(chatModelProviders)[0];
    const chatModel =
      body.chatModel?.model ||
      Object.keys(chatModelProviders[chatModelProvider])[0];

    let llm: BaseChatModel | undefined;

    if (body.chatModel?.provider === 'custom_openai') {
      if (
        !body.chatModel?.customOpenAIBaseURL ||
        !body.chatModel?.customOpenAIKey
      ) {
        return res
          .status(400)
          .json({ message: 'Missing custom OpenAI base URL or key' });
      }

      llm = new ChatOpenAI({
        modelName: body.chatModel.model,
        openAIApiKey: body.chatModel.customOpenAIKey,
        temperature: 0.7,
        configuration: {
          baseURL: body.chatModel.customOpenAIBaseURL,
        },
      }) as unknown as BaseChatModel;
    } else if (
      chatModelProviders[chatModelProvider] &&
      chatModelProviders[chatModelProvider][chatModel]
    ) {
      llm = chatModelProviders[chatModelProvider][chatModel]
        .model as unknown as BaseChatModel | undefined;
    }

    if (!llm) {
      return res.status(400).json({ message: 'Invalid model selected' });
    }

    // Génération des IDs uniques
    const messageId = crypto.randomBytes(7).toString('hex');
    const chatId = crypto.randomBytes(7).toString('hex');

    // Préparation de la requête
    const expertSearchRequest: ExpertSearchRequest = {
      query: body.query,
      chat_history: chatHistory,
      messageId,
      chatId
    };

    // Recherche d'experts
    const expertResults = await handleExpertSearch(expertSearchRequest, llm);
    console.log("🔍 Experts trouvés:", expertResults.experts.length);

    // Format unifié de la réponse
    res.status(200).json({
      type: 'expert_results',
      messageId,
      data: {
        experts: expertResults.experts,
        synthese: expertResults.synthese,
        query: body.query
      }
    });

  } catch (err) {
    console.error("🔍 Erreur dans la recherche d'experts:", err);
    res.status(500).json({ message: 'Une erreur est survenue.' });
    logger.error(`Erreur dans la recherche d'experts: ${err.message}`);
  }
});

export default router; 