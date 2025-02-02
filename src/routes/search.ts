// import express from 'express';
// import logger from '../utils/logger';
// import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
// import type { Embeddings } from '@langchain/core/embeddings';
// import { ChatOpenAI } from '@langchain/openai';
// import {
//   getAvailableChatModelProviders,
//   getAvailableEmbeddingModelProviders,
// } from '../lib/providers';
// import { searchHandlers } from '../websocket/messageHandler';
// import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
// import { MetaSearchAgentType } from '../search/metaSearchAgent';
// import { checkIfSearchIsNeeded } from '../utils/checkSearch';
// import { generateDirectResponsePrompt } from '../prompts/directResponse'; // ✅ Fixed Import

// const router = express.Router();

// interface chatModel {
//   provider: string;
//   model: string;
//   customOpenAIBaseURL?: string;
//   customOpenAIKey?: string;
// }

// interface embeddingModel {
//   provider: string;
//   model: string;
// }

// interface ChatRequestBody {
//   optimizationMode: 'speed' | 'balanced';
//   focusMode: string;
//   chatModel?: chatModel;
//   embeddingModel?: embeddingModel;
//   query: string;
//   history: Array<[string, string]>;
// }

// router.post('/', async (req, res) => {
//   try {
//     const body: ChatRequestBody = req.body;

//     logger.info(`📥    - Query: "${body.query}", Focus Mode: "${body.focusMode}"`);
    
//     if (!body.focusMode || !body.query) {
//       logger.warn(`⚠️ Missing required fields: Focus Mode or Query`);
//       return res.status(400).json({ message: 'Missing focus mode or query' });
//     }

//     body.history = body.history || [];
//     body.optimizationMode = body.optimizationMode || 'balanced';

//     const history: BaseMessage[] = body.history.map((msg) => {
//       if (msg[0] === 'human') {
//         return new HumanMessage({ content: msg[1] });
//       } else {
//         return new AIMessage({ content: msg[1] });
//       }
//     });

//     const [chatModelProviders, embeddingModelProviders] = await Promise.all([
//       getAvailableChatModelProviders(),
//       getAvailableEmbeddingModelProviders(),
//     ]);

//     const chatModelProvider =
//       body.chatModel?.provider || Object.keys(chatModelProviders)[0];
//     const chatModel =
//       body.chatModel?.model ||
//       Object.keys(chatModelProviders[chatModelProvider])[0];

//     const embeddingModelProvider =
//       body.embeddingModel?.provider || Object.keys(embeddingModelProviders)[0];
//     const embeddingModel =
//       body.embeddingModel?.model ||
//       Object.keys(embeddingModelProviders[embeddingModelProvider])[0];

//     let llm: BaseChatModel | undefined;
//     let embeddings: Embeddings | undefined;

//     if (body.chatModel?.provider === 'custom_openai') {
//       if (!body.chatModel?.customOpenAIBaseURL || !body.chatModel?.customOpenAIKey) {
//         logger.warn(`⚠️ Missing custom OpenAI base URL or key`);
//         return res.status(400).json({ message: 'Missing custom OpenAI base URL or key' });
//       }

//       llm = new ChatOpenAI({
//         modelName: body.chatModel.model,
//         openAIApiKey: body.chatModel.customOpenAIKey,
//         temperature: 0.7,
//         configuration: {
//           baseURL: body.chatModel.customOpenAIBaseURL,
//         },
//       }) as unknown as BaseChatModel;
//     } else if (
//       chatModelProviders[chatModelProvider] &&
//       chatModelProviders[chatModelProvider][chatModel]
//     ) {
//       llm = chatModelProviders[chatModelProvider][chatModel]
//         .model as unknown as BaseChatModel | undefined;
//     }

//     if (
//       embeddingModelProviders[embeddingModelProvider] &&
//       embeddingModelProviders[embeddingModelProvider][embeddingModel]
//     ) {
//       embeddings = embeddingModelProviders[embeddingModelProvider][embeddingModel]
//         .model as Embeddings | undefined;
//     }

//     if (!llm || !embeddings) {
//       logger.error(`❌ Invalid model selection`);
//       return res.status(400).json({ message: 'Invalid model selected' });
//     }

//     // ✅ Determine whether a search is required
//     logger.info(`🔍 Checking if external search is needed for query: "${body.query}"`);
//     const shouldSearch = await checkIfSearchIsNeeded(llm, body.query, body.history);
//     logger.info(`🔍 Search Decision for query "${body.query}": ${shouldSearch ? 'YES' : 'NO'}`);

//     if (!shouldSearch) {
//       // ✅ AI can answer directly without search
//       logger.info(`🤖 Generating AI response without external search for: "${body.query}"`);
//       const directPrompt = generateDirectResponsePrompt(body.query, body.history);
//       const directResponse = await llm.invoke([new HumanMessage({ content: directPrompt })]);

//       logger.info(`✅ AI Response Generated: "${directResponse.content}"`);
//       return res.status(200).json({ message: directResponse.content, sources: [] });
//     }

//     // ✅ Proceed with search if needed
//     logger.info(`🌐 Performing external search for: "${body.query}"`);
//     const searchHandler: MetaSearchAgentType = searchHandlers[body.focusMode];

//     if (!searchHandler) {
//       logger.error(`❌ Invalid focus mode: "${body.focusMode}"`);
//       return res.status(400).json({ message: 'Invalid focus mode' });
//     }

//     const emitter = await searchHandler.searchAndAnswer(
//       body.query,
//       history,
//       llm,
//       embeddings,
//       body.optimizationMode,
//       [],
//     );

//     let message = '';
//     let sources = [];

//     emitter.on('data', (data) => {
//       const parsedData = JSON.parse(data);
//       if (parsedData.type === 'response') {
//         message += parsedData.data;
//       } else if (parsedData.type === 'sources') {
//         sources = parsedData.data;
//       }
//     });

//     emitter.on('end', () => {
//       logger.info(`✅ Search Completed: Message: "${message}", Sources: ${JSON.stringify(sources)}`);
//       res.status(200).json({ message, sources });
//     });

//     emitter.on('error', (data) => {
//       const parsedData = JSON.parse(data);
//       logger.error(`❌ Error in search processing: ${parsedData.data}`);
//       res.status(500).json({ message: parsedData.data });
//     });

//   } catch (err: any) {
//     logger.error(`❌ Error in processing request: ${err.message}`);
//     res.status(500).json({ message: 'An error has occurred.' });
//   }
// });

// export default router;
import express from 'express';
import logger from '../utils/logger';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import { ChatOpenAI } from '@langchain/openai';
import {
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '../lib/providers';
import { searchHandlers } from '../websocket/messageHandler';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { MetaSearchAgentType } from '../search/metaSearchAgent';

const router = express.Router();

interface chatModel {
  provider: string;
  model: string;
  customOpenAIBaseURL?: string;
  customOpenAIKey?: string;
}

interface embeddingModel {
  provider: string;
  model: string;
}

interface ChatRequestBody {
  optimizationMode: 'speed' | 'balanced';
  focusMode: string;
  chatModel?: chatModel;
  embeddingModel?: embeddingModel;
  query: string;
  history: Array<[string, string]>;
}

router.post('/', async (req, res) => {
  try {
    const body: ChatRequestBody = req.body;

    if (!body.focusMode || !body.query) {
      return res.status(400).json({ message: 'Missing focus mode or query' });
    }

    body.history = body.history || [];
    body.optimizationMode = body.optimizationMode || 'balanced';

    const history: BaseMessage[] = body.history.map((msg) => {
      if (msg[0] === 'human') {
        return new HumanMessage({
          content: msg[1],
        });
      } else {
        return new AIMessage({
          content: msg[1],
        });
      }
    });

    const [chatModelProviders, embeddingModelProviders] = await Promise.all([
      getAvailableChatModelProviders(),
      getAvailableEmbeddingModelProviders(),
    ]);

    const chatModelProvider =
      body.chatModel?.provider || Object.keys(chatModelProviders)[0];
    const chatModel =
      body.chatModel?.model ||
      Object.keys(chatModelProviders[chatModelProvider])[0];

    const embeddingModelProvider =
      body.embeddingModel?.provider || Object.keys(embeddingModelProviders)[0];
    const embeddingModel =
      body.embeddingModel?.model ||
      Object.keys(embeddingModelProviders[embeddingModelProvider])[0];

    let llm: BaseChatModel | undefined;
    let embeddings: Embeddings | undefined;

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

    if (
      embeddingModelProviders[embeddingModelProvider] &&
      embeddingModelProviders[embeddingModelProvider][embeddingModel]
    ) {
      embeddings = embeddingModelProviders[embeddingModelProvider][
        embeddingModel
      ].model as Embeddings | undefined;
    }

    if (!llm || !embeddings) {
      return res.status(400).json({ message: 'Invalid model selected' });
    }

    const searchHandler: MetaSearchAgentType = searchHandlers[body.focusMode];

    if (!searchHandler) {
      return res.status(400).json({ message: 'Invalid focus mode' });
    }

    const emitter = await searchHandler.searchAndAnswer(
      body.query,
      history,
      llm,
      embeddings,
      body.optimizationMode,
      [],
    );

    let message = '';
    let sources = [];

    emitter.on('data', (data) => {
      const parsedData = JSON.parse(data);
      if (parsedData.type === 'response') {
        message += parsedData.data;
      } else if (parsedData.type === 'sources') {
        sources = parsedData.data;
      }
    });

    emitter.on('end', () => {
      res.status(200).json({ message, sources });
    });

    emitter.on('error', (data) => {
      const parsedData = JSON.parse(data);
      res.status(500).json({ message: parsedData.data });
    });
  } catch (err: any) {
    logger.error(`Error in getting search results: ${err.message}`);
    res.status(500).json({ message: 'An error has occurred.' });
  }
});

export default router;