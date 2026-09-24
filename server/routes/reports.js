import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
router.use(auth);

// Enviar un reporte general (sugerencia de plataforma)
router.post('/general', async (req, res) => {
    try {
        const supabase = getDb();
        const { reason, details } = req.body;
        
        // Asumimos que question_id puede ser nulo para reportes generales
        const { error } = await supabase.from('question_reports').insert([{
            user_id: req.user.id,
            reason: reason || 'Sugerencia de Plataforma',
            details
        }]);

        if (error) throw error;
        res.json({ message: 'Sugerencia enviada exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Enviar un reporte
router.post('/:questionId', async (req, res) => {
    try {
        const supabase = getDb();
        const { questionId } = req.params;
        const { reason, details } = req.body;
        
        const { error } = await supabase.from('question_reports').insert([{
            question_id: questionId,
            user_id: req.user.id,
            reason,
            details
        }]);

        if (error) throw error;
        res.json({ message: 'Reporte enviado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Admin: Obtener reportes
router.get('/', async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Prohibido' });
    try {
        const supabase = getDb();
        
        const { data: reports, error } = await supabase
            .from('question_reports')
            .select(`
                *,
                questions (question_text, chapter_id, chapters (chapter_number, books (name))),
                users (username)
            `)
            .order('status', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Flatten the nested data structure for the frontend
        const formattedReports = reports.map(r => ({
            id: r.id,
            question_id: r.question_id,
            user_id: r.user_id,
            reason: r.reason,
            details: r.details,
            status: r.status,
            created_at: r.created_at,
            question_text: r.questions?.question_text,
            chapter_id: r.questions?.chapter_id,
            username: r.users?.username,
            chapter_number: r.questions?.chapters?.chapter_number,
            book_name: r.questions?.chapters?.books?.name
        }));

        res.json(formattedReports);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Admin: Actualizar estado del reporte
router.put('/:id', async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Prohibido' });
    try {
        const supabase = getDb();
        const { status } = req.body;
        
        const { error } = await supabase
            .from('question_reports')
            .update({ status })
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Estado actualizado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Admin: Eliminar un reporte (descartar)
router.delete('/:id', async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Prohibido' });
    try {
        const supabase = getDb();
        const { error } = await supabase
            .from('question_reports')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Reporte eliminado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
