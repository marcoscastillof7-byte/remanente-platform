import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
router.use(auth);

router.get('/:chapterId', async (req, res) => {
    try {
        const supabase = getDb();
        const { data: note, error } = await supabase
            .from('user_notes')
            .select('*')
            .eq('user_id', req.user.id)
            .eq('chapter_id', req.params.chapterId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // Ignorar error de "No rows found"
        res.json(note || { content: '' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.post('/:chapterId', async (req, res) => {
    const { content } = req.body;
    try {
        const supabase = getDb();
        
        // Obtener ID existente si hay uno
        const { data: existing } = await supabase
            .from('user_notes')
            .select('id')
            .eq('user_id', req.user.id)
            .eq('chapter_id', req.params.chapterId)
            .single();

        let error;
        if (existing) {
            const resUpdate = await supabase
                .from('user_notes')
                .update({ content, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
            error = resUpdate.error;
        } else {
            const resInsert = await supabase
                .from('user_notes')
                .insert([{
                    user_id: req.user.id,
                    chapter_id: req.params.chapterId,
                    content,
                    updated_at: new Date().toISOString()
                }]);
            error = resInsert.error;
        }

        if (error) throw error;
        res.json({ message: 'Nota guardada' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
