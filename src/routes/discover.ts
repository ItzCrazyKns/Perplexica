import express from 'express';
import DiscoverModel from '../database/mongodb/schema/discover';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const data = await DiscoverModel.find().exec();
    return res.json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
