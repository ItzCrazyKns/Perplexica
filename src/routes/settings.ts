import express from 'express';
import db from '../db';
import { settings, eq } from '../db/schema';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { chatModelProvider, chatModel, embeddingModelProvider, embeddingModel, openAIApiKey, openAIBaseURL } = req.body;
    // TODO: Add user authentication

    await db.delete(settings).execute();

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
    console.error('Error saving settings:', err);
    res.status(500).json({ message: 'An error occurred while saving settings' });
  }
});

router.get('/', async (req, res) => {
  try {
    // TODO: Add user authentication
    const userSettings = await db.query.settings.findFirst();
    if (!userSettings) {
      return res.status(404).json({ message: 'No settings found' });
    }
    res.status(200).json(userSettings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ message: 'An error occurred while fetching settings' });
  }
});

export default router;