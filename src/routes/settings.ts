import express from 'express';
import db from '../db';
import { settings } from '../db/schema';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { chatModelProvider, chatModel, embeddingModelProvider, embeddingModel, openAIApiKey, openAIBaseURL } = req.body;
    
    // TODO: Add user authentication
    
    await db.insert(settings).values({
      chatModelProvider,
      chatModel,
      embeddingModelProvider,
      embeddingModel,
      openAIApiKey,
      openAIBaseURL,
    }).execute();

    res.status(200).json({ message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ message: 'An error occurred while saving settings' });
  }
});

router.get('/', async (req, res) => {
  try {
    // TODO: Add user authentication
    const userSettings = await db.query.settings.findFirst();
    res.status(200).json(userSettings);
  } catch (err) {
    res.status(500).json({ message: 'An error occurred while fetching settings' });
  }
});

export default router;