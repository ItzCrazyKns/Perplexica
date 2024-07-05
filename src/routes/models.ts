import express from "express";
import logger from "../utils/logger";
import { getAvailableChatModelProviders, getAvailableEmbeddingModelProviders } from "../lib/providers";

const router = express.Router();

router.get("/", async (_request, res) => {
  try {
    const [chatModelProviders, embeddingModelProviders] = await Promise.all([
      getAvailableChatModelProviders(),
      getAvailableEmbeddingModelProviders(),
    ]);

    res.status(200).json({ chatModelProviders, embeddingModelProviders });
  } catch (error) {
    res.status(500).json({ message: "An error has occurred." });
    logger.error(error.message);
  }
});

export default router;
