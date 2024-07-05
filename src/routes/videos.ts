import express from "express";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { getAvailableChatModelProviders } from "../lib/providers";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import logger from "../utils/logger";
import handleVideoSearch from "../agents/videoSearchAgent";

const router = express.Router();

router.post("/", async (request, res) => {
  try {
    const { query, chat_history: raw_chat_history, chat_model_provider, chat_model } = request.body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chat_history = raw_chat_history.map((message: any) => {
      if (message.role === "user") {
        return new HumanMessage(message.content);
      } else if (message.role === "assistant") {
        return new AIMessage(message.content);
      }
    });

    const chatModels = await getAvailableChatModelProviders();
    const provider = chat_model_provider ?? Object.keys(chatModels)[0];
    const chatModel = chat_model ?? Object.keys(chatModels[provider])[0];

    let llm: BaseChatModel | undefined;

    if (chatModels[provider] && chatModels[provider][chatModel]) {
      llm = chatModels[provider][chatModel] as BaseChatModel | undefined;
    }

    if (!llm) {
      res.status(500).json({ message: "Invalid LLM model selected" });
      return;
    }

    const videos = await handleVideoSearch({ chat_history, query }, llm);

    res.status(200).json({ videos });
  } catch (error) {
    res.status(500).json({ message: "An error has occurred." });
    logger.error(`Error in video search: ${error.message}`);
  }
});

export default router;
