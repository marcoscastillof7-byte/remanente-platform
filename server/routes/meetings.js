import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';
import { sendPushToAll } from '../utils/pushNotifier.js';
import { 
    activeRooms,
    endActiveRoom, 
    endAllActiveRooms, 
    updateRoomQuestions, 
    startRoomQuiz,
    submitRoomAnswer,
    revealRoomQuizResults,
    revealRoomQuestionResults,
    advanceRoomNextQuestion,
    endRoomSession,
    getRoomQuizProgress
} from '../socket/meetSocket.js';

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
 * POST /api/meetings/signed-upload-url
 * Genera una URL firmada de Supabase Storage para subir el PDF directamente a la nube
 */
router.post('/signed-upload-url', async (req, res) => {
    try {
        if (!isLeaderOrAdmin(req.user)) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }

        const { fileName } = req.body;
        const supabase = getDb();

        const cleanName = (fileName || 'document.pdf')
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .toLowerCase();
        const filePath = `pdf_${Date.now()}_${Math.random().toString(36).substring(7)}_${cleanName}`;

        const { data, error } = await supabase.storage
            .from('meet-pdfs')
            .createSignedUploadUrl(filePath);

        if (error) {
            console.error('[Meetings] Error creando signed URL:', error);
            return res.status(500).json({ error: 'Error al autorizar subida a la nube' });
        }

        const { data: publicUrlData } = supabase.storage
            .from('meet-pdfs')
            .getPublicUrl(filePath);

        res.json({
            signedUrl: data.signedUrl,
            path: data.path,
            token: data.token,
            publicUrl: publicUrlData.publicUrl
        });
    } catch (err) {
        console.error('[Meetings] Error en signed-upload-url:', err);
        res.status(500).json({ error: 'Error interno en la preparación de subida' });
    }
});

/**
 * POST /api/meetings/upload-pdf
 * Sube un archivo PDF directamente a Supabase Storage con Service Role (Respaldo)
 */
router.post('/upload-pdf', async (req, res) => {
    try {
        if (!isLeaderOrAdmin(req.user)) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }

        const { fileName, fileBase64 } = req.body;
        if (!fileBase64) {
            return res.status(400).json({ error: 'No se recibió contenido del archivo.' });
        }

        const supabase = getDb();
        const cleanName = (fileName || 'document.pdf')
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .toLowerCase();
        const filePath = `pdf_${Date.now()}_${Math.random().toString(36).substring(7)}_${cleanName}`;

        const base64Data = fileBase64.replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const { data, error } = await supabase.storage
            .from('meet-pdfs')
            .upload(filePath, buffer, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (error) {
            console.error('[Meetings] Error subiendo PDF a Supabase Storage:', error);
            return res.status(500).json({ error: 'Error al almacenar el archivo en la nube.' });
        }

        const { data: publicUrlData } = supabase.storage
            .from('meet-pdfs')
            .getPublicUrl(filePath);

        res.json({
            publicUrl: publicUrlData.publicUrl,
            path: filePath
        });
    } catch (err) {
        console.error('[Meetings] Error procesando subida de PDF:', err);
        res.status(500).json({ error: 'Error al procesar el archivo PDF.' });
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

        let finalPdfUrl = pdf_url || '';

        // Si por alguna razón llegó como base64 data URL, subir a Supabase Storage
        if (finalPdfUrl && finalPdfUrl.startsWith('data:')) {
            try {
                const base64Data = finalPdfUrl.replace(/^data:.*?;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                const filePath = `pdf_${Date.now()}_${Math.random().toString(36).substring(7)}_upload.pdf`;
                const { error: upErr } = await supabase.storage
                    .from('meet-pdfs')
                    .upload(filePath, buffer, { contentType: 'application/pdf', upsert: true });

                if (!upErr) {
                    finalPdfUrl = supabase.storage.from('meet-pdfs').getPublicUrl(filePath).data.publicUrl;
                }
            } catch (convErr) {
                console.error('[Meetings] Error procesando base64 en inserción:', convErr);
            }
        }

        const room_name = `meet_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const metaPayload = JSON.stringify({
            text: descriptionText || '',
            book_id: book_id || null,
            book_name: book_name || '',
            chapters_selected: chapters_selected || [],
            pdf_url: finalPdfUrl,
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

        if (req.app.get('io')) {
            req.app.get('io').emit('meet:updated');
        }

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

        const room = activeRooms.get(String(data.id));
        const currentPhase = room?.phase || meta.phase || (data.status === 'ended' ? 'finished' : 'reading');
        const revealedResults = room?.revealedResults || meta.revealedResults || null;

        // Recuperar lista de preguntas desde la sala activa o la descripción en base de datos
        const sourceQuestions = (room?.questions && room.questions.length > 0)
            ? room.questions
            : (meta.questions || []);

        const questionsList = sourceQuestions.map((q, idx) => ({
            id: q.id || `q_${idx}`,
            question_text: q.question_text || q.questionText,
            questionText: q.question_text || q.questionText,
            option_a: q.option_a || q.optionA,
            optionA: q.option_a || q.optionA,
            option_b: q.option_b || q.optionB,
            optionB: q.option_b || q.optionB,
            option_c: q.option_c || q.optionC,
            optionC: q.option_c || q.optionC,
            option_d: q.option_d || q.optionD,
            optionD: q.option_d || q.optionD,
            correct_answer: q.correct_answer || q.correctAnswer || 'a',
            correctAnswer: q.correct_answer || q.correctAnswer || 'a',
            explanation: q.explanation || 'Respuesta bíblica fundamentada en las Sagradas Escrituras.',
            verse_reference: q.verse_reference || q.verseReference || '',
            verseReference: q.verse_reference || q.verseReference || '',
            time_limit_seconds: q.time_limit_seconds || 25
        }));

        // Recuperar respuestas personales y estado del usuario actual (si ha salido o recargado)
        const userIdStr = String(req.user?.id || '');
        let myAnswersList = [];
        let myScore = 0;
        let myIsFinished = false;

        if (userIdStr) {
            if (room?.userAnswers && room.userAnswers.has(userIdStr)) {
                myAnswersList = Array.from(room.userAnswers.get(userIdStr).values());
            } else if (meta.savedUserAnswers && meta.savedUserAnswers[userIdStr]) {
                myAnswersList = Object.values(meta.savedUserAnswers[userIdStr]);
            }

            if (room?.participants && room.participants.has(userIdStr)) {
                myScore = room.participants.get(userIdStr).score || 0;
            } else if (meta.savedParticipants && meta.savedParticipants[userIdStr]) {
                myScore = meta.savedParticipants[userIdStr].score || 0;
            } else {
                myScore = myAnswersList.reduce((acc, ans) => acc + (Number(ans?.points) || 0), 0);
            }

            myIsFinished = questionsList.length > 0 && myAnswersList.length >= questionsList.length;
        }

        // Recuperar o reconstruir progreso del quiz
        let effectiveQuizProgress = room ? getRoomQuizProgress(room) : null;
        if (!effectiveQuizProgress && meta.savedUserAnswers) {
            const savedUsers = Object.keys(meta.savedUserAnswers);
            const participantsProgress = savedUsers.map(uId => {
                const uAns = Object.values(meta.savedUserAnswers[uId] || {});
                const sPart = meta.savedParticipants?.[uId] || {};
                const uScore = sPart.score !== undefined ? sPart.score : uAns.reduce((acc, a) => acc + (Number(a?.points) || 0), 0);
                return {
                    id: uId,
                    username: sPart.username || uAns[0]?.username || 'Participante',
                    score: uScore,
                    completedCount: uAns.length,
                    isFinished: questionsList.length > 0 && uAns.length >= questionsList.length
                };
            });
            const finishedCount = participantsProgress.filter(p => p.isFinished).length;
            effectiveQuizProgress = {
                meetId: String(data.id),
                totalQuestions: questionsList.length,
                totalParticipants: participantsProgress.length,
                finishedCount,
                allFinished: participantsProgress.length > 0 && finishedCount >= participantsProgress.length,
                participantsProgress,
                leaderboard: [...participantsProgress].sort((a, b) => b.score - a.score)
            };
        }

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
            phase: currentPhase,
            revealedResults,
            quizProgress: effectiveQuizProgress,
            // Datos personales persistentes recuperables al salir y volver a entrar
            myAnswers: myAnswersList,
            myScore,
            myIsFinished,
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
            req.app.get('io').emit('meet:updated');
        }

        res.json({ success: true, meeting });
    } catch (error) {
        console.error('[Meetings] Error iniciando Meet:', error);
        res.status(500).json({ error: 'Error interno al iniciar el Meet' });
    }
});

/**
 * POST /api/meetings/close-all
 * Cerrar todas las reuniones activas o programadas (Admin / Líder)
 */
router.post('/close-all', async (req, res) => {
    try {
        if (!isLeaderOrAdmin(req.user)) {
            return res.status(403).json({ error: 'Solo administradores o líderes pueden cerrar las reuniones.' });
        }

        const supabase = getDb();
        const { data, error } = await supabase
            .from('meetings')
            .update({ status: 'ended' })
            .neq('status', 'ended')
            .select('id, title, status');

        if (error) throw error;

        endAllActiveRooms();

        if (req.app.get('io')) {
            const io = req.app.get('io');
            io.emit('meet:phase-changed', { phase: 'finished' });
            io.emit('meet:session-ended', { 
                meetId: 'all', 
                message: 'Todas las reuniones han sido finalizadas por el administrador.',
                closed: true
            });
            io.emit('meet:updated');
        }

        res.json({ success: true, count: data?.length || 0 });
    } catch (error) {
        console.error('[Meetings] Error cerrando todas las reuniones:', error);
        res.status(500).json({ error: 'Error interno al cerrar las reuniones' });
    }
});

/**
 * POST /api/meetings/:id/start-quiz
 * Iniciar la fase de Quiz en vivo para el Meet (Solo Líder / Admin)
 */
router.post('/:id/start-quiz', async (req, res) => {
    try {
        if (!isLeaderOrAdmin(req.user)) {
            return res.status(403).json({ error: 'Solo administradores o líderes pueden iniciar el Quiz.' });
        }
        const io = req.app.get('io');
        const questions = req.body?.questions;
        const result = await startRoomQuiz(req.params.id, questions, io);
        if (result?.error) {
            return res.status(400).json({ error: result.error });
        }
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('[Meetings] Error iniciando quiz HTTP:', err);
        res.status(500).json({ error: 'Error al iniciar el quiz' });
    }
});

/**
 * POST /api/meetings/:id/submit-answer
 * Respaldo HTTP infalible para enviar respuestas a preguntas del Quiz en vivo
 */
router.post('/:id/submit-answer', async (req, res) => {
    try {
        const { questionIndex, selectedAnswer, timeTakenMs } = req.body;
        const io = req.app.get('io');
        const result = await submitRoomAnswer(req.params.id, questionIndex, selectedAnswer, timeTakenMs, req.user, io);
        if (result?.error) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (err) {
        console.error('[Meetings] Error en submit-answer HTTP:', err);
        res.status(500).json({ error: 'Error procesando respuesta' });
    }
});

/**
 * POST /api/meetings/:id/reveal-results & /reveal-quiz-results
 * Respaldo HTTP infalible para mostrar los resultados de la ronda y podio para todos los participantes
 */
router.post(['/:id/reveal-results', '/:id/reveal-quiz-results'], async (req, res) => {
    try {
        const supabase = getDb();
        const { data: meeting } = await supabase.from('meetings').select('host_id').eq('id', req.params.id).single();
        const isAuthorized = isLeaderOrAdmin(req.user) || (meeting && String(meeting.host_id) === String(req.user.id));
        if (!isAuthorized) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const io = req.app.get('io');
        const result = await revealRoomQuizResults(req.params.id, io);
        if (result?.error) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (err) {
        console.error('[Meetings] Error en reveal-results HTTP:', err);
        res.status(500).json({ error: 'Error revelando resultados' });
    }
});

/**
 * POST /api/meetings/:id/next-question
 * Respaldo HTTP infalible para avanzar a la siguiente pregunta del Quiz o mostrar el podio
 */
router.post('/:id/next-question', async (req, res) => {
    try {
        const supabase = getDb();
        const { data: meeting } = await supabase.from('meetings').select('host_id').eq('id', req.params.id).single();
        const isAuthorized = isLeaderOrAdmin(req.user) || (meeting && String(meeting.host_id) === String(req.user.id));
        if (!isAuthorized) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const io = req.app.get('io');
        const result = await advanceRoomNextQuestion(req.params.id, io);
        if (result?.error) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (err) {
        console.error('[Meetings] Error en next-question HTTP:', err);
        res.status(500).json({ error: 'Error avanzando pregunta' });
    }
});

/**
 * POST /api/meetings/:id/end-session
 * Respaldo HTTP infalible para finalizar y cerrar la sesión en vivo para todos los usuarios
 */
router.post('/:id/end-session', async (req, res) => {
    try {
        const supabase = getDb();
        const { data: meeting } = await supabase.from('meetings').select('host_id').eq('id', req.params.id).single();
        const isAuthorized = isLeaderOrAdmin(req.user) || (meeting && String(meeting.host_id) === String(req.user.id));
        if (!isAuthorized) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const io = req.app.get('io');
        const result = await endRoomSession(req.params.id, io);
        res.json(result);
    } catch (err) {
        console.error('[Meetings] Error en end-session HTTP:', err);
        res.status(500).json({ error: 'Error finalizando sesión' });
    }
});

/**
 * PUT /api/meetings/:id/phase
 * Cambiar fase de la reunión (reading, quiz, finished) por el líder / anfitrión
 */
router.put('/:id/phase', async (req, res) => {
    try {
        const { phase } = req.body;
        if (!phase) return res.status(400).json({ error: 'Fase requerida' });

        const supabase = getDb();
        const { data: meeting } = await supabase.from('meetings').select('host_id, description').eq('id', req.params.id).single();
        const isAuthorized = isLeaderOrAdmin(req.user) || (meeting && String(meeting.host_id) === String(req.user?.id));
        if (!isAuthorized) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const idStr = String(req.params.id);
        const room = activeRooms.get(idStr);
        if (room) {
            room.phase = phase;
            if (phase === 'reading') {
                room.revealedResults = null;
            }
        }

        let meta = {};
        try { meta = JSON.parse(meeting.description || '{}'); } catch {}
        meta.phase = phase;
        if (phase === 'reading') {
            meta.revealedResults = null;
        }
        await supabase.from('meetings').update({ description: JSON.stringify(meta) }).eq('id', idStr);

        const io = req.app.get('io');
        if (io) {
            io.to(`meet:${idStr}`).emit('meet:phase-changed', { meetId: idStr, phase });
            io.emit('meet:phase-changed', { meetId: idStr, phase });
        }

        res.json({ success: true, phase });
    } catch (err) {
        console.error('[Meetings] Error en change-phase HTTP:', err);
        res.status(500).json({ error: 'Error cambiando fase de reunión' });
    }
});

/**
 * PUT /api/meetings/:id/status
 * Actualizar estado (scheduled, live, ended)
 */
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const supabase = getDb();

        // Verificar si el usuario es líder, admin, o el anfitrión del meet
        const { data: currentMeet } = await supabase
            .from('meetings')
            .select('host_id')
            .eq('id', req.params.id)
            .single();

        const isAuthorized = isLeaderOrAdmin(req.user) ||
            (currentMeet && String(currentMeet.host_id) === String(req.user?.id));

        if (!isAuthorized) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const { data, error } = await supabase
            .from('meetings')
            .update({ status })
            .eq('id', req.params.id)
            .select('*')
            .single();

        if (error) throw error;

        if (status === 'ended') {
            const io = req.app.get('io');
            await endRoomSession(req.params.id, io);
        } else if (req.app.get('io')) {
            const io = req.app.get('io');
            io.emit('meet:updated');
        }

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

/**
 * DELETE /api/meetings/clear-past
 * Borrar todo el historial de reuniones pasadas/finalizadas (Solo Admins y Líderes)
 */
router.delete('/clear-past', async (req, res) => {
    try {
        if (!isLeaderOrAdmin(req.user)) {
            return res.status(403).json({ error: 'Solo administradores o líderes pueden borrar el historial de reuniones.' });
        }

        const supabase = getDb();
        const { data, error } = await supabase
            .from('meetings')
            .delete()
            .in('status', ['ended', 'finished', 'closed'])
            .select('id, title');

        if (error) throw error;

        if (req.app.get('io')) {
            req.app.get('io').emit('meet:updated');
        }

        res.json({ success: true, count: data?.length || 0 });
    } catch (error) {
        console.error('[Meetings] Error borrando historial:', error);
        res.status(500).json({ error: 'Error interno al borrar el historial de reuniones' });
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
        if (req.app.get('io')) {
            req.app.get('io').emit('meet:updated');
        }
        res.json({ message: 'Meet eliminado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

/**
 * PUT /api/meetings/:id/questions
 * Actualizar o importar preguntas de un Meet existente (Host, Admin o Líder)
 */
router.put('/:id/questions', async (req, res) => {
    try {
        const { questions } = req.body;
        if (!Array.isArray(questions)) {
            return res.status(400).json({ error: 'Se esperaba un array de preguntas.' });
        }

        const supabase = getDb();
        const { data: meeting, error: fetchErr } = await supabase
            .from('meetings')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (fetchErr || !meeting) {
            return res.status(404).json({ error: 'Reunión no encontrada.' });
        }

        const isAuthorized = isLeaderOrAdmin(req.user) || String(meeting.host_id) === String(req.user.id);
        if (!isAuthorized) {
            return res.status(403).json({ error: 'No tienes permisos para modificar las preguntas de este Meet.' });
        }

        let meta = {};
        try {
            meta = JSON.parse(meeting.description || '{}');
        } catch {
            meta = { text: meeting.description };
        }

        const sanitized = questions.map((q, idx) => ({
            id: q.id || `q_${Date.now()}_${idx}_${Math.random().toString(36).substring(7)}`,
            question_text: String(q.question_text || '').trim(),
            option_a: String(q.option_a || '').trim(),
            option_b: String(q.option_b || '').trim(),
            option_c: String(q.option_c || '').trim(),
            option_d: String(q.option_d || '').trim(),
            correct_answer: String(q.correct_answer || 'a').toLowerCase().trim(),
            explanation: String(q.explanation || '').trim(),
            verse_reference: String(q.verse_reference || '').trim(),
            time_limit_seconds: Number(q.time_limit_seconds) || 25
        })).filter(q => q.question_text && (q.option_a || q.option_b));

        meta.questions = sanitized;

        const { data: updatedMeeting, error: updateErr } = await supabase
            .from('meetings')
            .update({ description: JSON.stringify(meta) })
            .eq('id', req.params.id)
            .select('*')
            .single();

        if (updateErr) throw updateErr;

        // Actualizar en memoria si la sala está activa
        updateRoomQuestions(req.params.id, sanitized);

        if (req.app.get('io')) {
            const io = req.app.get('io');
            io.to(`meet:${req.params.id}`).emit('meet:questions-updated', {
                questions: sanitized,
                count: sanitized.length
            });
            io.emit('meet:updated');
        }

        res.json({
            success: true,
            count: sanitized.length,
            questions: sanitized
        });
    } catch (err) {
        console.error('[Meetings] Error actualizando preguntas:', err);
        res.status(500).json({ error: 'Error al actualizar las preguntas' });
    }
});

// Alias POST para clientes o proxies que limiten verbos PUT
router.post('/:id/questions', async (req, res, next) => {
    req.method = 'PUT';
    router.handle(req, res, next);
});

export default router;
