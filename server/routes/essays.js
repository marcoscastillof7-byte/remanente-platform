import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
router.use(auth);

// Obtener preguntas activas y estado de respuesta del usuario
router.get('/active', async (req, res) => {
    try {
        const supabase = getDb();
        const { data: questions, error: qErr } = await supabase
            .from('essay_questions')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        if (qErr) throw qErr;

        // Obtener respuestas del usuario
        const { data: responses, error: rErr } = await supabase
            .from('essay_responses')
            .select('*')
            .eq('user_id', req.user.id);
        if (rErr) throw rErr;

        const responseMap = {};
        responses.forEach(r => responseMap[r.question_id] = r);

        const result = questions.map(q => ({
            ...q,
            user_response: responseMap[q.id] || null
        }));

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Enviar respuesta
router.post('/:questionId/submit', async (req, res) => {
    try {
        const supabase = getDb();
        const { questionId } = req.params;
        const { response_text } = req.body;
        
        const { data: existing } = await supabase
            .from('essay_responses')
            .select('id')
            .eq('question_id', questionId)
            .eq('user_id', req.user.id)
            .single();
            
        if (existing) return res.status(400).json({ error: 'Ya enviaste una respuesta a esta pregunta.' });

        const { error } = await supabase.from('essay_responses').insert([{
            question_id: questionId,
            user_id: req.user.id,
            response_text,
            status: 'pending'
        }]);
        
        if (error) throw error;
        res.json({ message: 'Respuesta enviada para evaluación' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// RUTAS DE ADMIN (Protegidas)
router.use(async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
});

// Listar todas las preguntas (para admin)
router.get('/admin/questions', async (req, res) => {
    try {
        const supabase = getDb();
        const { data, error } = await supabase.from('essay_questions').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({error: 'Error'}) }
});

// Crear pregunta
router.post('/admin/questions', async (req, res) => {
    try {
        const supabase = getDb();
        const { question_text, points_reward } = req.body;
        const { error } = await supabase.from('essay_questions').insert([{ question_text, points_reward }]);
        if (error) throw error;
        res.json({ message: 'Pregunta creada' });
    } catch (err) { res.status(500).json({error: 'Error'}) }
});

// Activar/Desactivar pregunta
router.put('/admin/questions/:id/toggle', async (req, res) => {
    try {
        const supabase = getDb();
        const { is_active } = req.body;
        const { error } = await supabase.from('essay_questions').update({ is_active }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ message: 'Estado actualizado' });
    } catch (err) { res.status(500).json({error: 'Error'}) }
});

// Obtener todas las respuestas
router.get('/admin/responses', async (req, res) => {
    try {
        const supabase = getDb();
        const { data, error } = await supabase
            .from('essay_responses')
            .select(`
                *,
                user:users!user_id(username),
                question:essay_questions!question_id(question_text, points_reward)
            `)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({error: 'Error'}) }
});

// Evaluar respuesta
router.post('/admin/responses/:id/evaluate', async (req, res) => {
    try {
        const supabase = getDb();
        const { status } = req.body; // 'approved' o 'rejected'
        const responseId = req.params.id;
        
        const { data: responseInfo, error: rErr } = await supabase
            .from('essay_responses')
            .select('*, question:essay_questions!question_id(points_reward)')
            .eq('id', responseId)
            .single();
            
        if (rErr || !responseInfo) throw rErr;
        if (responseInfo.status !== 'pending') return res.status(400).json({error: 'Esta respuesta ya fue evaluada'});

        // Dar puntos si se aprueba
        if (status === 'approved') {
            // Eliminar de la base de datos según requerimiento
            await supabase.from('essay_responses').delete().eq('id', responseId);
            
            const pointsToAward = responseInfo.question.points_reward || 500;
            const { data: uData } = await supabase.from('users').select('points').eq('id', responseInfo.user_id).single();
            if (uData) {
                await supabase.from('users').update({ points: uData.points + pointsToAward }).eq('id', responseInfo.user_id);
            }
            
            // Notificar
            await supabase.from('notifications').insert([{
                user_id: responseInfo.user_id,
                title: '¡Respuesta Aprobada!',
                message: `Tu respuesta extendida fue aprobada. Ganaste ${pointsToAward} pts.`,
                link: '/essays'
            }]);
        } else {
            // Actualizar respuesta a rechazada
            await supabase.from('essay_responses').update({ status }).eq('id', responseId);
            
            // Notificar rechazo
            await supabase.from('notifications').insert([{
                user_id: responseInfo.user_id,
                title: 'Respuesta Evaluada',
                message: `Tu respuesta ha sido leída pero no cumplió con los criterios para los puntos esta vez. ¡Sigue intentando!`,
                link: '/essays'
            }]);
        }

        res.json({ message: 'Evaluada correctamente' });
    } catch (err) { 
        console.error(err);
        res.status(500).json({error: 'Error'}) 
    }
});

export default router;
