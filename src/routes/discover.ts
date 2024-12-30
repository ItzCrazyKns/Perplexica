import { Router } from 'express';
import { supabase } from '../db/supabase';

const router = Router();

// Route pour récupérer les experts
router.get('/experts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('experts')
      .select('*');
    
    if (error) throw error;
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching experts:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 