import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';

const router = express.Router();
router.use(auth);

router.get('/:chapterId', async (req, res) => {
    try {
        const supabase = getDb();
        // Leemos de 'questions' en lugar de 'flashcards' para que se autogeneren
        const { data: questions, error: qError } = await supabase
            .from('questions')
            .select('*')
            .eq('chapter_id', req.params.chapterId);

        if (qError) throw qError;

        if (!questions || questions.length === 0) {
            return res.json([]);
        }

        const result = questions.map(q => {
            const correctLetter = q.correct_answer || 'a';
            const correctText = q[`option_${correctLetter}`] || '';
            let back = `Respuesta: ${correctText}`;
            if (q.explanation) back += `\n\nExpl: ${q.explanation}`;

            return {
                id: q.id, // usamos el ID de la pregunta
                chapter_id: q.chapter_id,
                front_text: q.question_text,
                back_text: back,
                verse_reference: q.verse_reference,
                confidence_level: 0, // Reiniciamos o ignoramos el progreso para evitar FK errors
                review_count: 0
            };
        });

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.post('/', adminOnly, async (req, res) => {
    // Ya no se usa directamente desde la UI si usamos preguntas como flashcards,
    // pero lo dejamos por compatibilidad o futuros usos.
    res.status(201).json({ id: 0, message: 'Flashcards ahora se autogeneran desde preguntas.' });
});

router.put('/:id/progress', async (req, res) => {
    // Como estamos usando IDs de preguntas, insertar en flashcard_progress fallará 
    // por la restricción de llave foránea (FK) hacia la tabla flashcards.
    // Simplemente ignoramos silenciosamente el progreso por ahora para que no rompa la UI.
    res.json({ message: 'Progreso de sesión actualizado (no persistido)' });
});

export default router;
