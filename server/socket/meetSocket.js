import { getDb } from '../db/database.js';

// Almacén en memoria de salas activas para latencia 0ms
const activeRooms = new Map();

// Registro en memoria de sockets y usuarios conectados a la plataforma en tiempo real
const globalPlatformSockets = new Map(); // socketId -> { userId, username, lastPing }

/**
 * Devuelve la cantidad de usuarios únicos actualmente conectados a la plataforma
 */
export function getPlatformOnlineCount() {
    const uniqueUsers = new Set();
    let anonymousCount = 0;
    for (const info of globalPlatformSockets.values()) {
        if (info.userId) {
            uniqueUsers.add(String(info.userId));
        } else {
            anonymousCount++;
        }
    }
    return Math.max(1, uniqueUsers.size + anonymousCount);
}

/**
 * Emite las estadísticas de usuarios conectados a toda la plataforma
 */
export function broadcastPlatformOnlineStats(io) {
    if (!io) return;
    const onlineCount = getPlatformOnlineCount();
    io.emit('platform:online-stats', {
        onlineCount,
        timestamp: Date.now()
    });
}

/**
 * Limpia y marca como finalizada una sala activa en memoria
 */
export function endActiveRoom(meetId) {
    const idStr = String(meetId);
    const room = activeRooms.get(idStr);
    if (room) {
        if (room.revealTimer) {
            clearTimeout(room.revealTimer);
            room.revealTimer = null;
        }
        room.status = 'ended';
        room.phase = 'finished';
        activeRooms.delete(idStr);
    }
}

/**
 * Limpia y finaliza todas las salas activas en memoria
 */
export function endAllActiveRooms() {
    for (const [id, room] of activeRooms.entries()) {
        if (room.revealTimer) {
            clearTimeout(room.revealTimer);
            room.revealTimer = null;
        }
        room.status = 'ended';
        room.phase = 'finished';
    }
    activeRooms.clear();
}

/**
 * Actualiza las preguntas de una sala activa en memoria
 */
export function updateRoomQuestions(meetId, questions) {
    const idStr = String(meetId);
    const room = activeRooms.get(idStr);
    if (room) {
        room.questions = Array.isArray(questions) ? questions : [];
    }
}

/**
 * Resuelve la letra normalizada de la opción correcta ('a', 'b', 'c', 'd')
 * Maneja casos donde la respuesta guardada sea texto, mayúscula, prefijo o número
 */
export function getCorrectOptionLetter(q) {
    if (!q) return 'a';
    const raw = String(q.correct_answer || '').trim().toLowerCase();
    if (['a', 'b', 'c', 'd'].includes(raw)) return raw;

    // Comparar con el texto de cada opción
    const optA = String(q.option_a || '').trim().toLowerCase();
    const optB = String(q.option_b || '').trim().toLowerCase();
    const optC = String(q.option_c || '').trim().toLowerCase();
    const optD = String(q.option_d || '').trim().toLowerCase();

    if (raw && optA && raw === optA) return 'a';
    if (raw && optB && raw === optB) return 'b';
    if (raw && optC && raw === optC) return 'c';
    if (raw && optD && raw === optD) return 'd';

    // Prefijos como "a)", "a.", "(a)"
    const match = raw.match(/^[\(\[]?([a-d])[\)\]\.\:\-]/);
    if (match && match[1]) return match[1];

    if (raw === '1') return 'a';
    if (raw === '2') return 'b';
    if (raw === '3') return 'c';
    if (raw === '4') return 'd';

    return raw || 'a';
}

/**
 * Valida si la respuesta seleccionada por un usuario es correcta
 */
export function isAnswerCorrect(q, selectedAnswer) {
    if (!q || selectedAnswer === undefined || selectedAnswer === null) return false;
    const correctLetter = getCorrectOptionLetter(q);
    const sel = String(selectedAnswer || '').trim().toLowerCase();

    if (sel === correctLetter) return true;

    // Verificar si el usuario mandó el texto de la opción correcta
    const correctText = String(q[`option_${correctLetter}`] || '').trim().toLowerCase();
    if (correctText && sel === correctText) return true;

    return false;
}

/**
 * Obtiene o inicializa el estado de una sala Meet
 */
export async function getOrCreateRoom(meetId) {
    const idStr = String(meetId);
    if (activeRooms.has(idStr)) {
        return activeRooms.get(idStr);
    }

    const supabase = getDb();
    const { data: meeting, error } = await supabase
        .from('meetings')
        .select('*, users:host_id(id, username)')
        .eq('id', meetId)
        .single();

    if (error || !meeting) {
        return null;
    }

    let meta = {};
    try {
        meta = JSON.parse(meeting.description || '{}');
    } catch {
        meta = { text: meeting.description };
    }

    const roomState = {
        meetId: idStr,
        title: meeting.title,
        hostId: String(meeting.host_id),
        hostName: meeting.users?.username || 'Líder',
        pdfUrl: meta.pdf_url || '',
        bookId: meta.book_id || null,
        bookName: meta.book_name || '',
        chaptersSelected: meta.chapters_selected || [],
        questions: meta.questions || [],
        status: meeting.status || 'scheduled',
        phase: meeting.status === 'live' ? 'reading' : (meeting.status || 'scheduled'),
        currentPage: 1,
        currentQuestionIndex: -1,
        questionStartTime: null,
        questionTimeLimit: 25,
        participants: new Map(), // userId (String) -> { id, username, score, handRaised, isHost, avatar, socketId, connected }
        allTimeParticipants: new Map(), // userId (String) -> { id, username, role, firstJoinedAt }
        peakAttendance: 0,
        answers: new Map(), // questionIndex (Number) -> Map(userId (String) -> { userId, username, selectedAnswer, isCorrect, points, timeTakenMs })
        handsRaised: new Set(),
        currentReader: null,
        revealedResults: null,
        revealTimer: null
    };

    activeRooms.set(idStr, roomState);
    return roomState;
}

/**
 * Revela los resultados de la pregunta y emite a la sala y globalmente
 */
export async function revealRoomQuestionResults(meetId, questionIndex, io = null) {
    const idStr = String(meetId);
    let room = activeRooms.get(idStr);
    if (!room) room = await getOrCreateRoom(idStr);
    if (!room) return { error: 'Sala Meet no encontrada' };

    const qIdxNum = Number(questionIndex);
    if (room.revealTimer) {
        clearTimeout(room.revealTimer);
        room.revealTimer = null;
    }

    const q = room.questions[qIdxNum];
    if (!q) return { error: 'Pregunta no encontrada en la sala' };

    const correctLetter = getCorrectOptionLetter(q);
    const qAnswers = room.answers.get(qIdxNum) || new Map();

    const breakdown = { a: 0, b: 0, c: 0, d: 0 };
    qAnswers.forEach((ans) => {
        let opt = String(ans.selectedAnswer || '').trim().toLowerCase();
        // Normalizar texto de opción a letra si fuera necesario
        if (!['a', 'b', 'c', 'd'].includes(opt)) {
            if (opt === String(q.option_a || '').trim().toLowerCase()) opt = 'a';
            else if (opt === String(q.option_b || '').trim().toLowerCase()) opt = 'b';
            else if (opt === String(q.option_c || '').trim().toLowerCase()) opt = 'c';
            else if (opt === String(q.option_d || '').trim().toLowerCase()) opt = 'd';
        }
        if (breakdown[opt] !== undefined) {
            breakdown[opt]++;
        }
    });

    // Asegurar que cualquier participante que respondió esté registrado en room.participants
    qAnswers.forEach((ans, uId) => {
        const uIdStr = String(uId);
        if (!room.participants.has(uIdStr)) {
            room.participants.set(uIdStr, {
                id: uIdStr,
                username: ans.username || 'Participante',
                score: ans.points || 0,
                connected: true,
                handRaised: false
            });
        }
    });

    // Clasificar detalladamente a todos los participantes: Correctos, Incorrectos y Sin responder
    const correctParticipants = [];
    const incorrectParticipants = [];
    const unrespondedParticipants = [];

    room.participants.forEach((p) => {
        const pIdStr = String(p.id);
        const ans = qAnswers.get(pIdStr);
        if (ans) {
            if (ans.isCorrect) {
                correctParticipants.push({
                    id: pIdStr,
                    username: p.username,
                    selectedAnswer: ans.selectedAnswer,
                    pointsGained: ans.points,
                    timeTakenMs: ans.timeTakenMs,
                    totalScore: p.score || 0
                });
            } else {
                incorrectParticipants.push({
                    id: pIdStr,
                    username: p.username,
                    selectedAnswer: ans.selectedAnswer,
                    pointsGained: 0,
                    timeTakenMs: ans.timeTakenMs,
                    totalScore: p.score || 0
                });
            }
        } else {
            unrespondedParticipants.push({
                id: pIdStr,
                username: p.username,
                selectedAnswer: null,
                pointsGained: 0,
                totalScore: p.score || 0
            });
        }
    });

    // Ordenar tabla de posicionamiento completa (todos los participantes)
    const leaderboard = Array.from(room.participants.values())
        .sort((a, b) => (b.score || 0) - (a.score || 0));

    const resultsPayload = {
        meetId: idStr,
        questionIndex: qIdxNum,
        correctAnswer: correctLetter,
        explanation: q.explanation || 'Respuesta bíblica fundamentada.',
        verseReference: q.verse_reference || '',
        breakdown,
        correctParticipants,
        incorrectParticipants,
        unrespondedParticipants,
        leaderboard,
        hasNextQuestion: (qIdxNum + 1) < room.questions.length,
        totalQuestions: room.questions.length
    };

    room.revealedResults = resultsPayload;

    if (io) {
        io.to(`meet:${idStr}`).emit('meet:question-results', resultsPayload);
        io.emit('meet:question-results', resultsPayload);
    }

    return { success: true, results: resultsPayload };
}

/**
 * Procesa la respuesta de un usuario a una pregunta en vivo (usado por WebSocket y endpoint HTTP de respaldo)
 */
export async function submitRoomAnswer(meetId, questionIndex, selectedAnswer, timeTakenMs, userObj, io = null) {
    const idStr = String(meetId);
    let room = activeRooms.get(idStr);
    if (!room) room = await getOrCreateRoom(idStr);
    if (!room || !userObj) return { error: 'Sala o usuario no válidos' };

    const qIdxNum = Number(questionIndex);
    if (room.phase !== 'quiz') {
        return { error: 'El Meet no está en fase de quiz' };
    }
    if (Number(room.currentQuestionIndex) !== qIdxNum) {
        return { error: 'La pregunta especificada no es la que está activa actualmente' };
    }

    let questionAnswers = room.answers.get(qIdxNum);
    if (!questionAnswers) {
        questionAnswers = new Map();
        room.answers.set(qIdxNum, questionAnswers);
    }

    const userIdStr = String(userObj.id);

    // Si ya respondió, devolver el resultado ya registrado sin duplicar puntos
    if (questionAnswers.has(userIdStr)) {
        const existing = questionAnswers.get(userIdStr);
        return { 
            alreadyAnswered: true, 
            isCorrect: existing.isCorrect, 
            points: existing.points,
            selectedAnswer: existing.selectedAnswer
        };
    }

    const q = room.questions[qIdxNum];
    const isCorrect = isAnswerCorrect(q, selectedAnswer);

    // Puntuación estilo Kahoot: Base 50 + velocidad hasta 50 puntos adicionales
    let points = 0;
    if (isCorrect) {
        const limitMs = (q.time_limit_seconds || 25) * 1000;
        const safeTimeMs = Math.max(0, Math.min(limitMs, Number(timeTakenMs) || 1000));
        const timeLeftRatio = Math.max(0, Math.min(1, 1 - (safeTimeMs / limitMs)));
        const speedBonus = Math.round(timeLeftRatio * 50);
        points = 50 + speedBonus;
    }

    const cleanSelectedAnswer = String(selectedAnswer || '').trim().toLowerCase();
    questionAnswers.set(userIdStr, {
        userId: userIdStr,
        username: userObj.username || 'Participante',
        selectedAnswer: cleanSelectedAnswer,
        isCorrect,
        points,
        timeTakenMs: Number(timeTakenMs) || 0
    });

    // Actualizar o crear participante en la sala
    let participant = room.participants.get(userIdStr);
    if (participant) {
        participant.score = (participant.score || 0) + points;
    } else {
        participant = {
            id: userIdStr,
            username: userObj.username || 'Participante',
            role: userObj.role || 'user',
            isHost: userIdStr === String(room.hostId),
            score: points,
            handRaised: false,
            connected: true
        };
        room.participants.set(userIdStr, participant);
    }

    // Calcular listas de quiénes ya respondieron y quiénes faltan en tiempo real
    const answeredParticipants = [];
    const pendingParticipants = [];

    room.participants.forEach((p) => {
        const pIdStr = String(p.id);
        const ans = questionAnswers.get(pIdStr);
        if (ans) {
            answeredParticipants.push({
                id: pIdStr,
                username: p.username,
                score: p.score || 0,
                isCorrect: ans.isCorrect,
                selectedAnswer: ans.selectedAnswer,
                points: ans.points,
                timeTakenMs: ans.timeTakenMs
            });
        } else {
            pendingParticipants.push({
                id: pIdStr,
                username: p.username,
                score: p.score || 0
            });
        }
    });

    const currentLeaderboard = Array.from(room.participants.values())
        .sort((a, b) => (b.score || 0) - (a.score || 0));

    const answerStatusPayload = {
        meetId: idStr,
        questionIndex: qIdxNum,
        answeredCount: questionAnswers.size,
        totalParticipants: room.participants.size,
        answeredParticipants,
        pendingParticipants,
        allAnswered: pendingParticipants.length === 0 && room.participants.size > 0,
        leaderboard: currentLeaderboard
    };

    if (io) {
        io.to(`meet:${idStr}`).emit('meet:answer-status-updated', answerStatusPayload);
        io.emit('meet:answer-status-updated', answerStatusPayload);

        io.to(`meet:${idStr}`).emit('meet:answer-count-updated', {
            meetId: idStr,
            answeredCount: questionAnswers.size,
            totalParticipants: room.participants.size
        });
    }

    return { 
        success: true, 
        isCorrect, 
        points, 
        selectedAnswer: cleanSelectedAnswer,
        answerStatus: answerStatusPayload 
    };
}

/**
 * Inicia la fase de Quiz en vivo de una reunión de manera infalible
 */
export async function startRoomQuiz(meetId, payloadQuestions = null, io = null) {
    const idStr = String(meetId);
    let room = activeRooms.get(idStr);
    if (!room) {
        room = await getOrCreateRoom(idStr);
    }
    if (!room) return { error: 'Sala Meet no encontrada' };

    // 1. Si el payload trae preguntas y la sala no tenía, utilizarlas
    if ((!room.questions || room.questions.length === 0) && Array.isArray(payloadQuestions) && payloadQuestions.length > 0) {
        room.questions = payloadQuestions;
    }

    // 2. Si sigue vacía, intentar recuperar de Supabase meetings
    const supabase = getDb();
    if (!room.questions || room.questions.length === 0) {
        try {
            const { data: dbMeet } = await supabase.from('meetings').select('description').eq('id', idStr).single();
            if (dbMeet?.description) {
                const meta = JSON.parse(dbMeet.description);
                if (Array.isArray(meta.questions) && meta.questions.length > 0) {
                    room.questions = meta.questions;
                }
            }
        } catch (e) {}
    }

    // 3. Si aún sigue vacía, auto-cargar preguntas reales del banco de datos de los capítulos seleccionados
    if (!room.questions || room.questions.length === 0) {
        try {
            let query = supabase.from('questions').select('*');
            if (room.chaptersSelected && room.chaptersSelected.length > 0) {
                query = query.in('chapter_id', room.chaptersSelected);
            }
            const { data: autoQs } = await query.limit(15);
            if (autoQs && autoQs.length > 0) {
                room.questions = autoQs.map((q, idx) => ({
                    id: q.id || `auto_${idx}`,
                    question_text: q.question_text,
                    option_a: q.option_a,
                    option_b: q.option_b,
                    option_c: q.option_c,
                    option_d: q.option_d,
                    correct_answer: q.correct_answer || 'a',
                    explanation: q.explanation || 'Respuesta bíblica fundamentada.',
                    verse_reference: q.verse_reference || '',
                    time_limit_seconds: 25
                }));
            } else {
                const { data: fallbackQs } = await supabase.from('questions').select('*').limit(15);
                if (fallbackQs && fallbackQs.length > 0) {
                    room.questions = fallbackQs.map((q, idx) => ({
                        id: q.id || `auto_${idx}`,
                        question_text: q.question_text,
                        option_a: q.option_a,
                        option_b: q.option_b,
                        option_c: q.option_c,
                        option_d: q.option_d,
                        correct_answer: q.correct_answer || 'a',
                        explanation: q.explanation || 'Respuesta bíblica fundamentada.',
                        verse_reference: q.verse_reference || '',
                        time_limit_seconds: 25
                    }));
                }
            }

            // Persistir preguntas en Supabase description para que no se pierdan
            if (room.questions && room.questions.length > 0) {
                try {
                    const { data: currentMeet } = await supabase.from('meetings').select('description').eq('id', idStr).single();
                    let currentMeta = {};
                    try { currentMeta = JSON.parse(currentMeet?.description || '{}'); } catch {}
                    currentMeta.questions = room.questions;
                    await supabase.from('meetings').update({ description: JSON.stringify(currentMeta) }).eq('id', idStr);
                } catch (persErr) {}
            }
        } catch (dbErr) {
            console.error('[meetSocket] Error auto-recuperando preguntas:', dbErr);
        }
    }

    if (!room.questions || room.questions.length === 0) {
        return { error: 'Esta sala no tiene preguntas cargadas. Añade preguntas con el botón "Importar Preguntas".' };
    }

    room.phase = 'quiz';
    room.currentQuestionIndex = 0;
    room.questionStartTime = Date.now();
    room.revealedResults = null;
    room.answers.set(0, new Map());

    const q = room.questions[0];
    const leaderboard = Array.from(room.participants.values())
        .sort((a, b) => (b.score || 0) - (a.score || 0));

    const questionPayload = {
        id: q.id || 'q_0',
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        time_limit_seconds: q.time_limit_seconds || 25
    };

    if (io) {
        io.to(`meet:${idStr}`).emit('meet:phase-changed', { phase: 'quiz', meetId: idStr });
        io.to(`meet:${idStr}`).emit('meet:question-started', {
            meetId: idStr,
            questionIndex: 0,
            totalQuestions: room.questions.length,
            question: questionPayload,
            leaderboard
        });

        // Estado inicial de respuestas
        io.to(`meet:${idStr}`).emit('meet:answer-status-updated', {
            meetId: idStr,
            questionIndex: 0,
            answeredCount: 0,
            totalParticipants: room.participants.size,
            answeredParticipants: [],
            pendingParticipants: Array.from(room.participants.values()).map(p => ({
                id: String(p.id),
                username: p.username,
                score: p.score || 0
            })),
            allAnswered: false,
            leaderboard
        });

        // Emisión global como respaldo ante reconexiones
        io.emit('meet:phase-changed', { phase: 'quiz', meetId: idStr });
        io.emit('meet:question-started', {
            meetId: idStr,
            questionIndex: 0,
            totalQuestions: room.questions.length,
            question: questionPayload,
            leaderboard
        });
    }

    if (room.revealTimer) clearTimeout(room.revealTimer);
    const timeLimitSec = (q.time_limit_seconds || 25) + 3;
    if (io) {
        room.revealTimer = setTimeout(() => {
            if (room.phase === 'quiz' && room.currentQuestionIndex === 0 && !room.revealedResults) {
                revealRoomQuestionResults(idStr, 0, io);
            }
        }, timeLimitSec * 1000);
    }

    return { success: true, totalQuestions: room.questions.length };
}

/**
 * Avanza a la siguiente pregunta del Quiz o pasa al Podio Final
 */
export async function advanceRoomNextQuestion(meetId, io = null) {
    const idStr = String(meetId);
    let room = activeRooms.get(idStr);
    if (!room) room = await getOrCreateRoom(idStr);
    if (!room) return { error: 'Sala Meet no encontrada' };

    const nextIndex = room.currentQuestionIndex + 1;

    if (nextIndex < room.questions.length) {
        room.currentQuestionIndex = nextIndex;
        room.questionStartTime = Date.now();
        room.revealedResults = null;
        room.answers.set(nextIndex, new Map());

        const q = room.questions[nextIndex];
        const leaderboard = Array.from(room.participants.values())
            .sort((a, b) => (b.score || 0) - (a.score || 0));

        const nextQuestionPayload = {
            meetId: idStr,
            questionIndex: nextIndex,
            totalQuestions: room.questions.length,
            question: {
                id: q.id || `q_${nextIndex}`,
                question_text: q.question_text,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                time_limit_seconds: q.time_limit_seconds || 25
            },
            leaderboard
        };

        const nextStatusPayload = {
            meetId: idStr,
            questionIndex: nextIndex,
            answeredCount: 0,
            totalParticipants: room.participants.size,
            answeredParticipants: [],
            pendingParticipants: Array.from(room.participants.values()).map(p => ({
                id: String(p.id),
                username: p.username,
                score: p.score || 0
            })),
            allAnswered: false,
            leaderboard
        };

        if (io) {
            io.to(`meet:${idStr}`).emit('meet:question-started', nextQuestionPayload);
            io.emit('meet:question-started', nextQuestionPayload);

            io.to(`meet:${idStr}`).emit('meet:answer-status-updated', nextStatusPayload);
            io.emit('meet:answer-status-updated', nextStatusPayload);
        }

        if (room.revealTimer) clearTimeout(room.revealTimer);
        const timeLimitSec = (q.time_limit_seconds || 25) + 3;
        if (io) {
            room.revealTimer = setTimeout(() => {
                if (room.phase === 'quiz' && room.currentQuestionIndex === nextIndex && !room.revealedResults) {
                    revealRoomQuestionResults(idStr, nextIndex, io);
                }
            }, timeLimitSec * 1000);
        }

        return { success: true, nextIndex, hasNext: true };
    } else {
        if (room.revealTimer) {
            clearTimeout(room.revealTimer);
            room.revealTimer = null;
        }

        // QUIZ TERMINADO -> PODIO FINAL
        room.phase = 'finished';
        room.revealedResults = null;
        const finalPodium = Array.from(room.participants.values())
            .sort((a, b) => (b.score || 0) - (a.score || 0));

        const totalAttendance = room.allTimeParticipants ? room.allTimeParticipants.size : room.participants.size;

        if (io) {
            io.to(`meet:${idStr}`).emit('meet:phase-changed', { phase: 'finished', meetId: idStr });
            io.emit('meet:phase-changed', { phase: 'finished', meetId: idStr });

            io.to(`meet:${idStr}`).emit('meet:final-podium', { 
                meetId: idStr,
                podium: finalPodium,
                totalJoinedCount: totalAttendance,
                platformOnlineCount: getPlatformOnlineCount()
            });
            io.emit('meet:final-podium', { 
                meetId: idStr,
                podium: finalPodium,
                totalJoinedCount: totalAttendance,
                platformOnlineCount: getPlatformOnlineCount()
            });
        }

        // Acreditar Puntos de Sabiduría a los participantes en la base de datos
        try {
            const supabase = getDb();
            for (let p of finalPodium) {
                if (p.score > 0) {
                    const { data: u } = await supabase.from('users').select('points').eq('id', p.id).single();
                    const currentPts = (u && u.points) ? u.points : 0;
                    await supabase.from('users').update({ points: currentPts + p.score }).eq('id', p.id);
                }
            }
            await supabase.from('meetings').update({ status: 'ended' }).eq('id', idStr);
            if (io) {
                io.emit('leaderboard-update');
                io.emit('meet:updated');
            }
        } catch (dbErr) {
            console.error('[MeetSocket] Error guardando puntos finales:', dbErr);
        }

        return { success: true, finished: true, podium: finalPodium };
    }
}

/**
 * Finaliza y cierra la sesión Meet en vivo de forma completa
 */
export async function endRoomSession(meetId, io = null) {
    const idStr = String(meetId);
    let room = activeRooms.get(idStr);
    const supabase = getDb();

    let finalPodium = [];
    let totalAttendance = 0;
    if (room) {
        if (room.revealTimer) {
            clearTimeout(room.revealTimer);
            room.revealTimer = null;
        }
        room.status = 'ended';
        room.phase = 'finished';
        finalPodium = Array.from(room.participants.values())
            .sort((a, b) => (b.score || 0) - (a.score || 0));
        totalAttendance = room.allTimeParticipants ? room.allTimeParticipants.size : room.participants.size;
    }

    const endedPayload = { 
        meetId: idStr,
        message: 'La reunión ha sido finalizada por el líder.',
        closed: true,
        podium: finalPodium,
        totalJoinedCount: totalAttendance,
        platformOnlineCount: getPlatformOnlineCount()
    };

    if (io) {
        io.to(`meet:${idStr}`).emit('meet:phase-changed', { meetId: idStr, phase: 'finished' });
        io.emit('meet:phase-changed', { meetId: idStr, phase: 'finished' });

        io.to(`meet:${idStr}`).emit('meet:session-ended', endedPayload);
        io.emit('meet:session-ended', endedPayload);

        io.to(`meet:${idStr}`).emit('meet:final-podium', { 
            meetId: idStr,
            podium: finalPodium,
            totalJoinedCount: totalAttendance,
            platformOnlineCount: getPlatformOnlineCount()
        });
        io.emit('meet:final-podium', { 
            meetId: idStr,
            podium: finalPodium,
            totalJoinedCount: totalAttendance,
            platformOnlineCount: getPlatformOnlineCount()
        });
    }

    try {
        if (finalPodium.length > 0) {
            for (let p of finalPodium) {
                if (p.score > 0) {
                    const { data: u } = await supabase.from('users').select('points').eq('id', p.id).single();
                    const currentPts = (u && u.points) ? u.points : 0;
                    await supabase.from('users').update({ points: currentPts + p.score }).eq('id', p.id);
                }
            }
        }
        await supabase.from('meetings').update({ status: 'ended' }).eq('id', idStr);
        activeRooms.delete(idStr);
        if (io) {
            io.emit('leaderboard-update');
            io.emit('meet:updated');
        }
    } catch (dbErr) {
        console.error('[MeetSocket] Error finalizando reunión:', dbErr);
    }

    return { success: true, endedPayload };
}

/**
 * Inicializador principal de los eventos WebSocket de Socket.io
 */
export function setupMeetSocket(io) {
    io.on('connection', (socket) => {
        let currentMeetId = null;
        let currentUser = null;

        // Registrar conexión activa en la plataforma
        globalPlatformSockets.set(socket.id, { lastPing: Date.now() });
        broadcastPlatformOnlineStats(io);

        // Identificación de usuario conectado en cualquier parte de la plataforma
        socket.on('platform:identify', (userData) => {
            if (userData && (userData.id || userData.username)) {
                globalPlatformSockets.set(socket.id, {
                    userId: String(userData.id),
                    username: userData.username,
                    lastPing: Date.now()
                });
                broadcastPlatformOnlineStats(io);
            }
        });

        // 1. UNIRSE A LA SALA MEET
        socket.on('meet:join', async ({ meetId, user }) => {
            if (!meetId || !user) return;
            currentMeetId = String(meetId);
            currentUser = user;
            socket.data = socket.data || {};
            socket.data.user = user;

            const userIdStr = String(user.id);

            // Actualizar identificación global en plataforma
            globalPlatformSockets.set(socket.id, {
                userId: userIdStr,
                username: user.username,
                lastPing: Date.now()
            });
            broadcastPlatformOnlineStats(io);

            socket.join(`meet:${currentMeetId}`);
            const room = await getOrCreateRoom(currentMeetId);
            if (!room) {
                socket.emit('meet:error', { message: 'Sala no encontrada' });
                return;
            }

            if (room.status === 'ended') {
                socket.emit('meet:session-ended', { 
                    meetId: currentMeetId,
                    message: 'Esta reunión ya ha sido finalizada.',
                    closed: true 
                });
                return;
            }

            const isHost = userIdStr === String(room.hostId) || user.role === 'admin' || user.role === 'superadmin';
            
            // Si el usuario ya estaba, preservar score
            const existing = room.participants.get(userIdStr);
            const score = existing ? (existing.score || 0) : 0;

            room.participants.set(userIdStr, {
                id: userIdStr,
                username: user.username,
                role: user.role,
                isHost,
                score,
                handRaised: room.handsRaised.has(userIdStr),
                socketId: socket.id,
                connected: true
            });

            // Registrar en el histórico de asistencia total de este Meet
            if (!room.allTimeParticipants) {
                room.allTimeParticipants = new Map();
            }
            room.allTimeParticipants.set(userIdStr, {
                id: userIdStr,
                username: user.username,
                role: user.role
            });
            room.peakAttendance = Math.max(room.peakAttendance || 0, room.participants.size);

            // Enviar estado completo inicial al participante que se unió
            const sanitizedQuestions = room.questions.map((q, idx) => ({
                id: q.id || `q_${idx}`,
                question_text: q.question_text,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                time_limit_seconds: q.time_limit_seconds || 25,
                correct_answer: isHost ? q.correct_answer : null,
                explanation: isHost ? q.explanation : null,
                verse_reference: isHost ? q.verse_reference : null
            }));

            const sortedLeaderboard = Array.from(room.participants.values())
                .sort((a, b) => (b.score || 0) - (a.score || 0));

            let currentAnswerStatus = null;
            let currentRemainingTime = 25;
            let myHasAnswered = false;
            let mySelectedAnswer = null;

            if (room.phase === 'quiz' && room.currentQuestionIndex >= 0) {
                const qIdx = Number(room.currentQuestionIndex);
                const questionAnswers = room.answers.get(qIdx) || new Map();
                const answeredParticipants = [];
                const pendingParticipants = [];

                room.participants.forEach((p) => {
                    const pIdStr = String(p.id);
                    const ans = questionAnswers.get(pIdStr);
                    if (ans) {
                        answeredParticipants.push({
                            id: pIdStr,
                            username: p.username,
                            score: p.score || 0,
                            isCorrect: ans.isCorrect,
                            selectedAnswer: ans.selectedAnswer,
                            points: ans.points,
                            timeTakenMs: ans.timeTakenMs
                        });
                    } else {
                        pendingParticipants.push({
                            id: pIdStr,
                            username: p.username,
                            score: p.score || 0
                        });
                    }
                });

                currentAnswerStatus = {
                    meetId: currentMeetId,
                    questionIndex: qIdx,
                    answeredCount: questionAnswers.size,
                    totalParticipants: room.participants.size,
                    answeredParticipants,
                    pendingParticipants,
                    allAnswered: pendingParticipants.length === 0 && room.participants.size > 0,
                    leaderboard: sortedLeaderboard
                };

                const myAns = questionAnswers.get(userIdStr);
                if (myAns) {
                    myHasAnswered = true;
                    mySelectedAnswer = myAns.selectedAnswer;
                }

                if (room.questionStartTime && room.questions[qIdx]) {
                    const limitSec = room.questions[qIdx].time_limit_seconds || 25;
                    const elapsed = Math.floor((Date.now() - room.questionStartTime) / 1000);
                    currentRemainingTime = Math.max(0, limitSec - elapsed);
                }
            }

            const currentQ = (room.phase === 'quiz' && room.currentQuestionIndex >= 0 && room.questions[room.currentQuestionIndex]) ? {
                id: room.questions[room.currentQuestionIndex].id || `q_${room.currentQuestionIndex}`,
                question_text: room.questions[room.currentQuestionIndex].question_text,
                option_a: room.questions[room.currentQuestionIndex].option_a,
                option_b: room.questions[room.currentQuestionIndex].option_b,
                option_c: room.questions[room.currentQuestionIndex].option_c,
                option_d: room.questions[room.currentQuestionIndex].option_d,
                time_limit_seconds: room.questions[room.currentQuestionIndex].time_limit_seconds || 25
            } : null;

            socket.emit('meet:initial-state', {
                meetId: room.meetId,
                title: room.title,
                hostId: room.hostId,
                hostName: room.hostName,
                pdfUrl: room.pdfUrl,
                bookName: room.bookName,
                chaptersSelected: room.chaptersSelected,
                phase: room.phase,
                currentPage: room.currentPage,
                currentQuestionIndex: room.currentQuestionIndex,
                currentQuestion: currentQ,
                currentReader: room.currentReader,
                questionsCount: room.questions.length,
                participants: Array.from(room.participants.values()),
                questions: sanitizedQuestions,
                revealedResults: room.revealedResults,
                leaderboard: sortedLeaderboard,
                answerStatus: currentAnswerStatus,
                timeLeft: currentRemainingTime,
                hasAnswered: myHasAnswered,
                selectedAnswer: mySelectedAnswer,
                totalJoinedCount: room.allTimeParticipants ? room.allTimeParticipants.size : room.participants.size,
                peakAttendance: room.peakAttendance || room.participants.size,
                platformOnlineCount: getPlatformOnlineCount()
            });

            // Avisar a los demás
            io.to(`meet:${currentMeetId}`).emit('meet:participants-updated', {
                participants: Array.from(room.participants.values()),
                totalCount: room.participants.size,
                totalJoinedCount: room.allTimeParticipants ? room.allTimeParticipants.size : room.participants.size,
                peakAttendance: room.peakAttendance || room.participants.size,
                platformOnlineCount: getPlatformOnlineCount()
            });
        });

        // 2. SINCRONIZACIÓN DE PÁGINA (Solo Líder/Host)
        socket.on('meet:change-page', ({ meetId, page }) => {
            const room = activeRooms.get(String(meetId));
            if (!room) return;
            if (currentUser && (String(currentUser.id) === String(room.hostId) || currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
                room.currentPage = page;
                io.to(`meet:${meetId}`).emit('meet:page-synced', { page });
            }
        });

        // 3. PUNTERO LÁSER VIRTUAL DEL LÍDER
        socket.on('meet:laser-move', ({ meetId, x, y, active }) => {
            const room = activeRooms.get(String(meetId));
            if (!room) return;
            if (currentUser && (String(currentUser.id) === String(room.hostId) || currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
                socket.to(`meet:${meetId}`).emit('meet:laser-synced', { x, y, active });
            }
        });

        // 4. LEVANTAR / BAJAR LA MANO
        socket.on('meet:toggle-hand', ({ meetId }) => {
            const room = activeRooms.get(String(meetId));
            if (!room || !currentUser) return;

            const userIdStr = String(currentUser.id);
            const isRaised = room.handsRaised.has(userIdStr);
            if (isRaised) {
                room.handsRaised.delete(userIdStr);
            } else {
                room.handsRaised.add(userIdStr);
            }

            const p = room.participants.get(userIdStr);
            if (p) p.handRaised = !isRaised;

            io.to(`meet:${meetId}`).emit('meet:hands-updated', {
                handsRaised: Array.from(room.handsRaised),
                participants: Array.from(room.participants.values())
            });
        });

        // 5. ASIGNAR LECTOR (Solo Líder/Host)
        socket.on('meet:assign-reader', ({ meetId, readerId, readerName }) => {
            const room = activeRooms.get(String(meetId));
            if (!room) return;
            if (currentUser && (String(currentUser.id) === String(room.hostId) || currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
                room.currentReader = readerId ? { id: readerId, name: readerName } : null;
                io.to(`meet:${meetId}`).emit('meet:reader-assigned', { reader: room.currentReader });
            }
        });

        // 5.1 ACTUALIZAR / IMPORTAR PREGUNTAS EN VIVO (Líder / Host)
        socket.on('meet:update-questions', ({ meetId, questions }) => {
            const room = activeRooms.get(String(meetId));
            if (!room) return;
            const isAuthorized = currentUser && (
                String(currentUser.id) === String(room.hostId) ||
                ['admin', 'superadmin', 'lider', 'leader'].includes((currentUser.role || '').toLowerCase())
            );
            if (!isAuthorized) return;

            room.questions = Array.isArray(questions) ? questions : [];
            io.to(`meet:${meetId}`).emit('meet:questions-updated', {
                questions: room.questions,
                count: room.questions.length
            });
            io.emit('meet:updated');
        });

        // 6. INICIAR FASE DE QUIZ / PREGUNTAS (Solo Líder/Host)
        socket.on('meet:start-quiz', async ({ meetId, questions: payloadQuestions }) => {
            const isAuthorized = currentUser && (
                ['admin', 'superadmin', 'lider', 'leader'].includes((currentUser.role || '').toLowerCase()) ||
                (activeRooms.get(String(meetId)) && String(currentUser.id) === String(activeRooms.get(String(meetId)).hostId))
            );
            if (!isAuthorized) return;

            const res = await startRoomQuiz(meetId, payloadQuestions, io);
            if (res?.error) {
                socket.emit('meet:error', { message: res.error });
            }
        });

        // 7. ENVIAR RESPUESTA A PREGUNTA EN VIVO
        socket.on('meet:submit-answer', async ({ meetId, questionIndex, selectedAnswer, timeTakenMs, user: payloadUser }) => {
            const userObj = currentUser || payloadUser || socket.data?.user;
            if (!userObj) return;

            const result = await submitRoomAnswer(meetId, questionIndex, selectedAnswer, timeTakenMs, userObj, io);
            if (result && !result.error) {
                socket.emit('meet:answer-received', { 
                    isCorrect: result.isCorrect, 
                    points: result.points, 
                    selectedAnswer: result.selectedAnswer 
                });
            }
        });

        // 8. REVELAR RESULTADOS DE LA PREGUNTA (Líder / Admin hace clic en "Mostrar Resultados")
        socket.on('meet:reveal-question-results', async ({ meetId, questionIndex }) => {
            const room = activeRooms.get(String(meetId));
            const isAuthorized = currentUser && (
                (room && String(currentUser.id) === String(room.hostId)) ||
                ['admin', 'superadmin', 'lider', 'leader'].includes((currentUser.role || '').toLowerCase())
            );
            if (!isAuthorized) return;

            await revealRoomQuestionResults(meetId, questionIndex, io);
        });

        // 9. SIGUIENTE PREGUNTA O FINALIZAR
        socket.on('meet:next-question', async ({ meetId }) => {
            const room = activeRooms.get(String(meetId));
            const isAuthorized = currentUser && (
                (room && String(currentUser.id) === String(room.hostId)) ||
                ['admin', 'superadmin', 'lider', 'leader'].includes((currentUser.role || '').toLowerCase())
            );
            if (!isAuthorized) return;

            await advanceRoomNextQuestion(meetId, io);
        });

        // 9.1. FINALIZAR / CERRAR REUNIÓN EN VIVO MANUALMENTE (Líder / Admin)
        socket.on('meet:end-session', async ({ meetId }) => {
            const room = activeRooms.get(String(meetId));
            const supabase = getDb();
            let isHostInDb = false;

            if (currentUser && !['admin', 'superadmin', 'lider', 'leader'].includes((currentUser.role || '').toLowerCase())) {
                try {
                    const { data: dbMeet } = await supabase.from('meetings').select('host_id').eq('id', meetId).single();
                    if (dbMeet && String(dbMeet.host_id) === String(currentUser.id)) {
                        isHostInDb = true;
                    }
                } catch (e) {}
            }

            const isAuthorized = currentUser && (
                (room && String(currentUser.id) === String(room.hostId)) ||
                isHostInDb ||
                ['admin', 'superadmin', 'lider', 'leader'].includes((currentUser.role || '').toLowerCase())
            );

            if (isAuthorized) {
                await endRoomSession(meetId, io);
            }
        });

        // 10. REACCIONES BÍBLICAS EN VIVO (Amén, Fuego, Gloria, Victoria)
        socket.on('meet:send-reaction', ({ meetId, reaction }) => {
            if (!meetId || !reaction || !currentUser) return;
            socket.to(`meet:${meetId}`).emit('meet:reaction-received', {
                userId: currentUser.id,
                username: currentUser.username,
                reaction,
                id: `${Date.now()}_${Math.random()}`
            });
        });

        // 11. DESCONEXIÓN CON PROTECCIÓN PARA RECONEXIONES MÓVILES
        socket.on('disconnect', () => {
            globalPlatformSockets.delete(socket.id);
            broadcastPlatformOnlineStats(io);

            if (currentMeetId && currentUser) {
                const room = activeRooms.get(currentMeetId);
                if (room) {
                    const userIdStr = String(currentUser.id);
                    const p = room.participants.get(userIdStr);
                    // Solo marcar como desconectado si el socket desconectado coincide con el socket registrado (evita borrar una reconexión entrante)
                    if (p && p.socketId === socket.id) {
                        p.connected = false;
                        p.lastDisconnectedAt = Date.now();
                        room.handsRaised.delete(userIdStr);

                        io.to(`meet:${currentMeetId}`).emit('meet:participants-updated', {
                            participants: Array.from(room.participants.values()),
                            totalCount: room.participants.size,
                            totalJoinedCount: room.allTimeParticipants ? room.allTimeParticipants.size : room.participants.size,
                            peakAttendance: room.peakAttendance || room.participants.size,
                            platformOnlineCount: getPlatformOnlineCount()
                        });
                    }
                }
            }
        });
    });
}
