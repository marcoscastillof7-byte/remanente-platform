import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';

const router = express.Router();
router.use(auth);

router.get('/:chapterId', async (req, res) => {
    try {
        const supabase = getDb();
        const { data: flashcards, error: fError } = await supabase
            .from('flashcards')
            .select('*')
            .eq('chapter_id', req.params.chapterId);

        if (fError) throw fError;

        if (flashcards.length === 0) {
            return res.json([]);
        }

        const { data: progress, error: pError } = await supabase
            .from('flashcard_progress')
            .select('flashcard_id, confidence_level, review_count')
            .eq('user_id', req.user.id)
            .in('flashcard_id', flashcards.map(f => f.id));

        if (pError) throw pError;

        const progressMap = {};
        for (let p of (progress || [])) {
            progressMap[p.flashcard_id] = p;
        }

        const result = flashcards.map(f => ({
            ...f,
            confidence_level: progressMap[f.id]?.confidence_level || 0,
            review_count: progressMap[f.id]?.review_count || 0
        }));

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.post('/', adminOnly, async (req, res) => {
    const { chapter_id, front_text, back_text, verse_reference } = req.body;
    try {
        const supabase = getDb();
        const { data, error } = await supabase
            .from('flashcards')
            .insert([{
                chapter_id,
                front_text,
                back_text,
                verse_reference,
                created_by: req.user.id
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ id: data.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.put('/:id/progress', async (req, res) => {
    const { confidence_level } = req.body;
    const flashcard_id = req.params.id;
    const user_id = req.user.id;

    try {
        const supabase = getDb();
        
        // Obtenemos el actual
        const { data: existing } = await supabase
            .from('flashcard_progress')
            .select('id, review_count')
            .eq('user_id', user_id)
            .eq('flashcard_id', flashcard_id)
            .single();

        let error;
        if (existing) {
            const resUpdate = await supabase
                .from('flashcard_progress')
                .update({
                    confidence_level,
                    last_reviewed: new Date().toISOString(),
                    review_count: (existing.review_count || 0) + 1
                })
                .eq('id', existing.id);
            error = resUpdate.error;
        } else {
            const resInsert = await supabase
                .from('flashcard_progress')
                .insert([{
                    user_id,
                    flashcard_id,
                    confidence_level,
                    last_reviewed: new Date().toISOString(),
                    review_count: 1
                }]);
            error = resInsert.error;
        }

        if (error) throw error;
        res.json({ message: 'Progreso actualizado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
