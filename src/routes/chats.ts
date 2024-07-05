import express from "express";
import logger from "../utils/logger";
import database from "../db/index";
import { eq } from "drizzle-orm";
import { chats, messages } from "../db/schema";

const router = express.Router();

router.get("/", async (_, res) => {
  try {
    let chats = await database.query.chats.findMany();

    chats = chats.reverse();

    return res.status(200).json({ chats: chats });
  } catch (error) {
    res.status(500).json({ message: "An error has occurred." });
    logger.error(`Error in getting chats: ${error.message}`);
  }
});

router.get("/:id", async (request, res) => {
  try {
    const chatExists = await database.query.chats.findFirst({
      where: eq(chats.id, request.params.id),
    });

    if (!chatExists) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const chatMessages = await database.query.messages.findMany({
      where: eq(messages.chatId, request.params.id),
    });

    return res.status(200).json({ chat: chatExists, messages: chatMessages });
  } catch (error) {
    res.status(500).json({ message: "An error has occurred." });
    logger.error(`Error in getting chat: ${error.message}`);
  }
});

router.delete(`/:id`, async (request, res) => {
  try {
    const chatExists = await database.query.chats.findFirst({
      where: eq(chats.id, request.params.id),
    });

    if (!chatExists) {
      return res.status(404).json({ message: "Chat not found" });
    }

    await database.delete(chats).where(eq(chats.id, request.params.id)).execute();
    await database.delete(messages).where(eq(messages.chatId, request.params.id)).execute();

    return res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "An error has occurred." });
    logger.error(`Error in deleting chat: ${error.message}`);
  }
});

export default router;
