import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';
import { sendPushToAll } from '../utils/pushNotifier.js';

const router = express.Router();
router.use(auth);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Helper para verificar rol de Administrador o Líder
function isLeaderOrAdmin(user) {
    if (!user) return false;
    const role = (user.role || '').toLowerCase();
    return role === 'admin' || role === 'superadmin' || role === 'lider' || role === 'leader';
}

/**
 * GET /api/meetings (o /api/meets)
 * Listar todas las reuniones (programadas, en vivo y finalizadas recientes)
 */
router.get('/', async (req, res) => {
    try {
        const supabase = getDb();
        const { data, error } = await supabase
            .from('meetings')
            .select(`
                id, title, description, scheduled_for, status, host_id, room_name, created_at,
                users:host_id (username)
            `)
            .order('scheduled_for', { ascending: false });
            
        if (error) throw error;

        // Parsear metadata JSON de cada sesión
        const formatted = (data || []).map(m => {
            let meta = {};
            try {
                meta = JSON.parse(m.description || '{}');
            } catch {
                meta = { text: m.description };
            }

            return {
                id: m.id,
                title: m.title,
                descriptionText: meta.text || meta.description || '',
                pdfUrl: meta.pdf_url || '',
                bookId: meta.book_id || null,
                bookName: meta.book_name || '',
                chaptersSelected: meta.chapters_selected || [],
                questionsCount: (meta.questions || []).length,
                scheduled_for: m.scheduled_for,
                status: m.status,
                host_id: m.host_id,
                host_name: m.users?.username || 'Líder',
                room_name: m.room_name,
                created_at: m.created_at
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('[Meetings] Error listando reuniones:', error);
        res.status(500).json({ error: 'Error interno al cargar los Meets' });
    }
});

/**
 * POST /api/meetings/generate-questions
 * Generador de preguntas con IA (Gemini) basado en Prompt del Admin y Capítulos seleccionados
 */
router.post('/generate-questions', async (req, res) => {
    try {
        if (!isLeaderOrAdmin(req.user)) {
            return res.status(403).json({ error: 'Solo administradores y líderes pueden generar preguntas para un Meet.' });
        }

        const { bookId, chapterIds, customPrompt, questionCount = 10, difficulty = 'medio' } = req.body;
        const supabase = getDb();

        let chapterNames = "";
        let targetChapterIds = chapterIds || [];

        if (targetChapterIds.length > 0) {
            const { data: chaps } = await supabase
                .from('chapters')
                .select('id, chapter_number, books(name)')
                .in('id', targetChapterIds);
                
            if (chaps) {
                chapterNames = chaps.map(c => `${c.books?.name} Capítulo ${c.chapter_number}`).join(', ');
            }
        }

        let generatedQuestions = [];
        let usedAI = false;

        // 1. Intentar generar con Gemini si hay API Key
        if (GEMINI_API_KEY && (chapterNames || customPrompt)) {
            const prompt = `Eres un erudito bíblico y pedagogo experto en la traducción Reina-Valera 1960.
Vas a crear un cuestionario interactivo para una reunión de estudio en vivo (Remanente Meet).
Capítulos seleccionados: ${chapterNames || 'Capítulos de estudio bíblico'}.
Enfoque / Instrucción especial del líder: "${customPrompt || 'Preguntas sobre los eventos clave, doctrinas y personajes principales'}".
Cantidad de preguntas: exactamente ${questionCount}.
Dificultad: ${difficulty}.

CRÍTICO:
- Cada pregunta debe ser precisa, profunda y 100% apegada a RV1960.
- Provee 4 opciones claras y plausibles (option_a, option_b, option_c, option_d).
- Indica correct_answer ('a', 'b', 'c', o 'd').
- Incluye explanation y verse_reference exacto (ej: '1 Samuel 17:45').

Devuelve ÚNICAMENTE un Array JSON sin texto extra:
[
  {
    "question_text": "¿Pregunta?",
    "option_a": "Opción A",
    "option_b": "Opción B",
    "option_c": "Opción C",
    "option_d": "Opción D",
    "correct_answer": "a",
    "explanation": "Explicación bíblica exacta",
    "verse_reference": "Libro X:Y",
    "time_limit_seconds": 25
  }
]`;

            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { response_mime_type: "application/json" }
                    })
                });

                const data = await response.json();
                if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                    const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        generatedQuestions = parsed;
                        usedAI = true;
                    }
                }
            } catch (aiErr) {
                console.warn('[Meetings] Fallo al generar con Gemini, usando banco de respaldo:', aiErr.message);
            }
        }

        // 2. Respaldo Resiliente: Extraer preguntas reales del banco de datos si la IA no está disponible
        if (!usedAI || generatedQuestions.length === 0) {
            let query = supabase.from('questions').select('*');
            if (targetChapterIds.length > 0) {
                query = query.in('chapter_id', targetChapterIds);
            }
            const { data: dbQs } = await query.limit(50);

            if (dbQs && dbQs.length > 0) {
                // Mezclar y tomar la cantidad pedida
                const shuffled = dbQs.sort(() => 0.5 - Math.random()).slice(0, questionCount);
                generatedQuestions = shuffled.map((q, idx) => ({
                    id: `q_${q.id || idx}`,
                    question_text: q.question_text,
                    option_a: q.option_a,
                    option_b: q.option_b,
                    option_c: q.option_c,
                    option_d: q.option_d,
                    correct_answer: q.correct_answer,
                    explanation: q.explanation || 'Respuesta según el texto bíblico.',
                    verse_reference: q.verse_reference || '',
                    time_limit_seconds: 25
                }));
            }
        }

        res.json({ questions: generatedQuestions, usedAI });
    } catch (error) {
        console.error('[Meetings] Error generando preguntas:', error);
        res.status(500).json({ error: 'Error al generar preguntas' });
    }
});

/**
 * POST /api/meetings
 * Crear un nuevo Meet (Solo Administradores y Líderes)
 */
router.post('/', async (req, res) => {
    try {
        if (!isLeaderOrAdmin(req.user)) {
            return res.status(403).json({ error: 'Acceso denegado. Solo administradores o líderes pueden crear un Meet.' });
        }

        const supabase = getDb();
        const {
            title,
            descriptionText,
            scheduled_for,
            book_id,
            book_name,
            chapters_selected,
            pdf_url,
            questions
        } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'El título del Meet es obligatorio.' });
        }

        const room_name = `meet_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const metaPayload = JSON.stringify({
            text: descriptionText || '',
            book_id: book_id || null,
            book_name: book_name || '',
            chapters_selected: chapters_selected || [],
            pdf_url: pdf_url || '',
            questions: Array.isArray(questions) ? questions : []
        });

        const scheduledTime = scheduled_for || new Date().toISOString();

        const { data, error } = await supabase.from('meetings').insert([{
            title,
            description: metaPayload,
            scheduled_for: scheduledTime,
            host_id: req.user.id,
            status: 'scheduled',
            room_name
        }]).select('*, users:host_id(username)').single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('[Meetings] Error creando Meet:', error);
        res.status(500).json({ error: 'Error interno al crear el Meet' });
    }
});

/**
 * GET /api/meetings/:id
 * Obtener detalles completos de un Meet
 */
router.get('/:id', async (req, res) => {
    try {
        const supabase = getDb();
        const { data, error } = await supabase
            .from('meetings')
            .select('*, users:host_id(id, username)')
            .eq('id', req.params.id)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Meet no encontrado' });
        }

        let meta = {};
        try {
            meta = JSON.parse(data.description || '{}');
        } catch {
            meta = { text: data.description };
        }

        const isHostOrAdmin = String(req.user.id) === String(data.host_id) || isLeaderOrAdmin(req.user);

        // Si el usuario no es el anfitrión y el quiz aún no termina, ocultar respuestas correctas
        const questionsList = (meta.questions || []).map((q, idx) => {
            if (isHostOrAdmin || data.status === 'ended') {
                return q;
            }
            return {
                id: q.id || `q_${idx}`,
                question_text: q.question_text,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                time_limit_seconds: q.time_limit_seconds || 25
            };
        });

        res.json({
            id: data.id,
            title: data.title,
            descriptionText: meta.text || '',
            pdfUrl: meta.pdf_url || '',
            bookId: meta.book_id || null,
            bookName: meta.book_name || '',
            chaptersSelected: meta.chapters_selected || [],
            questions: questionsList,
            scheduled_for: data.scheduled_for,
            status: data.status,
            host_id: data.host_id,
            host_name: data.users?.username || 'Líder',
            room_name: data.room_name,
            isHost: isHostOrAdmin,
            created_at: data.created_at
        });
    } catch (error) {
        console.error('[Meetings] Error obteniendo Meet:', error);
        res.status(500).json({ error: 'Error al cargar el Meet' });
    }
});

/**
 * POST /api/meetings/:id/start
 * Iniciar el Meet en vivo y enviar Push Notification a todos los miembros
 */
router.post('/:id/start', async (req, res) => {
    try {
        if (!isLeaderOrAdmin(req.user)) {
            return res.status(403).json({ error: 'Solo administradores o líderes pueden iniciar el Meet.' });
        }

        const supabase = getDb();
        const { data: meeting, error } = await supabase
            .from('meetings')
            .update({ status: 'live' })
            .eq('id', req.params.id)
            .select('*, users:host_id(username)')
            .single();

        if (error || !meeting) {
            return res.status(404).json({ error: 'No se pudo iniciar el Meet' });
        }

        let meta = {};
        try {
            meta = JSON.parse(meeting.description || '{}');
        } catch {
            meta = {};
        }

        const bookTitle = meta.book_name ? ` de ${meta.book_name}` : '';
        const hostName = meeting.users?.username || 'El líder';

        // Enviar notificación Push de alta prioridad a todos los dispositivos registrados
        sendPushToAll({
            title: '📖 ¡Remanente Meet en Vivo!',
            body: `${hostName} ha iniciado el estudio${bookTitle}. ¡Toca aquí para unirte a la lectura en vivo!`,
            url: `/meet/${meeting.id}`
        }).catch(err => console.error('[Push Meet] Error:', err.message));

        if (req.app.get('io')) {
            req.app.get('io').emit('meet:started', { meetId: meeting.id, title: meeting.title });
        }

        res.json({ success: true, meeting });
    } catch (error) {
        console.error('[Meetings] Error iniciando Meet:', error);
        res.status(500).json({ error: 'Error interno al iniciar el Meet' });
    }
});

/**
 * PUT /api/meetings/:id/status
 * Actualizar estado (scheduled, live, ended)
 */
router.put('/:id/status', async (req, res) => {
    try {
        if (!isLeaderOrAdmin(req.user)) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const { status } = req.body;
        const supabase = getDb();

        const { data, error } = await supabase
            .from('meetings')
            .update({ status })
            .eq('id', req.params.id)
            .select('*')
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

/**
 * DELETE /api/meetings/:id
 * Eliminar un Meet
 */
router.delete('/:id', async (req, res) => {
    try {
        if (!isLeaderOrAdmin(req.user)) {
            return res.status(403).json({ error: 'Solo los administradores o líderes pueden eliminar reuniones' });
        }

        const supabase = getDb();
        const { error } = await supabase
            .from('meetings')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Meet eliminado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
