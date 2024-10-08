import express from 'express';
import db from '../db';
import { authSettings } from '../db/schema';

const router = express.Router();

router.get('/', async (req, res) => {
  const settings = await db.select().from(authSettings).limit(1);
  res.json(settings[0] || { isEnabled: false, username: null, password: null });
});

router.post('/', async (req, res) => {
  const { isEnabled, username, password } = req.body;

  if (isEnabled && (!username || !password)) {
    return res.status(400).json({ message: 'Username and password are required when enabling authentication.' });
  }

  await db.insert(authSettings).values({
    isEnabled,
    username: isEnabled ? username : null,
    password: isEnabled ? password : null,
  }).onConflictDoUpdate({
    target: authSettings.id,
    set: { isEnabled, username: isEnabled ? username : null, password: isEnabled ? password : null },
  });

  res.status(200).json({ message: 'Authentication settings updated' });
});

export default router;