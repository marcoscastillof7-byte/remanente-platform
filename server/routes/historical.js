import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
router.use(auth);

router.get('/:chapterId', async (req, res) => {
    try {
        const supabase = getDb();
        const { data, error } = await supabase
            .from('historical_details')
            .select(`
                id, content, created_at, user_id,
                users(username)
            `)
            .eq('chapter_id', req.params.chapterId)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.post('/:chapterId', async (req, res) => {
    try {
        const supabase = getDb();
        const { content } = req.body;
        
        const { data, error } = await supabase.from('historical_details').insert([{
            chapter_id: req.params.chapterId,
            user_id: req.user.id,
            content
        }]).select('id, content, created_at, user_id, users(username)').single();
        
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
