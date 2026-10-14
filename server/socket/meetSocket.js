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
        quizStartedAt: null,
        participants: new Map(), // userId (String) -> { id, username, score, handRaised, isHost, avatar, socketId, connected }
        allTimeParticipants: new Map(), // userId (String) -> { id, username, role, firstJoinedAt }
        peakAttendance: 0,
        // userAnswers: userId (String) -> Map(questionIndex (Number) -> { selectedAnswer, isCorrect, points, timeTakenMs, timestamp })
        userAnswers: new Map(),
        // answers: questionIndex (Number) -> Map(userId (String) -> { userId, username, selectedAnswer, isCorrect, points, timeTakenMs })
        answers: new Map(),
        handsRaised: new Set(),
        currentReader: null,
        revealedResults: null,
        revealTimer: null
    };

    activeRooms.set(idStr, roomState);
    return roomState;
}

/**
 * Calcula en tiempo real el progreso de todos los participantes en el quiz
 */
export function getRoomQuizProgress(room) {
    if (!room) return null;
    const totalQuestions = (room.questions || []).length;
    
    const participantsList = Array.from(room.participants.values()).map(p => {
        const uIdStr = String(p.id);
        const uAnswers = room.userAnswers?.get(uIdStr) || new Map();
        const completedCount = uAnswers.size;
        const isFinished = totalQuestions > 0 && completedCount >= totalQuestions;
        
        let correctCount = 0;
        uAnswers.forEach(ans => {
            if (ans.isCorrect) correctCount++;
        });

        return {
            id: uIdStr,
            username: p.username,
            role: p.role,
            isHost: p.isHost,
            score: p.score || 0,
            completedCount,
            correctCount,
            totalQuestions,
            isFinished,
            connected: p.connected !== false
        };
    });

    const finishedCount = participantsList.filter(p => p.isFinished).length;
    const totalParticipants = participantsList.length;
    const allFinished = totalParticipants > 0 && finishedCount >= totalParticipants;
    const liveLeaderboard = [...participantsList].sort((a, b) => (b.score || 0) - (a.score || 0));

    return {
        meetId: String(room.meetId),
        totalQuestions,
        totalParticipants,
        finishedCount,
        allFinished,
        participantsProgress: participantsList,
        leaderboard: liveLeaderboard
    };
}

/**
 * Inicia la fase de Quiz en vivo de una reunión de manera infalible
 * Cada participante recibe el set de preguntas y responde a su propio ritmo
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
    room.quizStartedAt = Date.now();
    room.revealedResults = null;
    room.userAnswers = new Map();
    room.answers = new Map();

    // Resetear puntuaciones para la nueva ronda
    room.participants.forEach(p => {
        p.score = 0;
    });

    const sanitizedQuestions = room.questions.map((q, idx) => ({
        id: q.id || `q_${idx}`,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        time_limit_seconds: q.time_limit_seconds || 25
    }));

    const progress = getRoomQuizProgress(room);

    if (io) {
        io.to(`meet:${idStr}`).emit('meet:phase-changed', { phase: 'quiz', meetId: idStr });
        io.to(`meet:${idStr}`).emit('meet:quiz-started', {
            meetId: idStr,
            totalQuestions: room.questions.length,
            questions: sanitizedQuestions,
            progress
        });

        // Como respaldo para toda la sala
        io.emit('meet:phase-changed', { phase: 'quiz', meetId: idStr });
        io.emit('meet:quiz-started', {
            meetId: idStr,
            totalQuestions: room.questions.length,
            questions: sanitizedQuestions,
            progress
        });
    }

    return { 
        success: true, 
        totalQuestions: room.questions.length, 
        questions: sanitizedQuestions, 
        progress 
    };
}

/**
 * Procesa la respuesta de un usuario a una pregunta a su propio ritmo
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

    if (!room.userAnswers) room.userAnswers = new Map();
    if (!room.answers) room.answers = new Map();

    const userIdStr = String(userObj.id);

    let uAnswers = room.userAnswers.get(userIdStr);
    if (!uAnswers) {
        uAnswers = new Map();
        room.userAnswers.set(userIdStr, uAnswers);
    }

    let questionAnswers = room.answers.get(qIdxNum);
    if (!questionAnswers) {
        questionAnswers = new Map();
        room.answers.set(qIdxNum, questionAnswers);
    }

    const q = room.questions[qIdxNum];
    if (!q) {
        return { error: 'Índice de pregunta inválido' };
    }

    // Si ya respondió esta pregunta, devolver su resultado previo
    if (uAnswers.has(qIdxNum)) {
        const existing = uAnswers.get(qIdxNum);
        const progress = getRoomQuizProgress(room);
        return {
            alreadyAnswered: true,
            questionIndex: qIdxNum,
            selectedAnswer: existing.selectedAnswer,
            correctAnswer: getCorrectOptionLetter(q),
            isCorrect: existing.isCorrect,
            points: existing.points,
            completedCount: uAnswers.size,
            totalQuestions: room.questions.length,
            isFinished: uAnswers.size >= room.questions.length,
            progress
        };
    }

    const isCorrect = isAnswerCorrect(q, selectedAnswer);
    let points = 0;
    if (isCorrect) {
        const limitMs = (q.time_limit_seconds || 25) * 1000;
        const safeTimeMs = Math.max(0, Math.min(limitMs, Number(timeTakenMs) || 1000));
        const timeLeftRatio = Math.max(0, Math.min(1, 1 - (safeTimeMs / limitMs)));
        const speedBonus = Math.round(timeLeftRatio * 50);
        points = 50 + speedBonus;
    }

    const cleanSelectedAnswer = String(selectedAnswer || '').trim().toLowerCase();
    const answerEntry = {
        userId: userIdStr,
        username: userObj.username || 'Participante',
        questionIndex: qIdxNum,
        selectedAnswer: cleanSelectedAnswer,
        isCorrect,
        points,
        timeTakenMs: Number(timeTakenMs) || 0,
        timestamp: Date.now()
    };

    uAnswers.set(qIdxNum, answerEntry);
    questionAnswers.set(userIdStr, answerEntry);

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

    const progress = getRoomQuizProgress(room);
    const isFinished = uAnswers.size >= room.questions.length;

    if (io) {
        io.to(`meet:${idStr}`).emit('meet:quiz-progress-updated', progress);
        io.emit('meet:quiz-progress-updated', progress);

        if (progress.allFinished) {
            io.to(`meet:${idStr}`).emit('meet:all-participants-finished', progress);
            io.emit('meet:all-participants-finished', progress);
        }
    }

    return {
        success: true,
        questionIndex: qIdxNum,
        selectedAnswer: cleanSelectedAnswer,
        correctAnswer: getCorrectOptionLetter(q),
        explanation: q.explanation || 'Respuesta bíblica fundamentada.',
        verseReference: q.verse_reference || '',
        isCorrect,
        points,
        totalScore: participant.score,
        completedCount: uAnswers.size,
        totalQuestions: room.questions.length,
        isFinished,
        progress
    };
}

/**
 * Revela los resultados de todo el quiz para todos los participantes
 * Muestra el podio final y el desglose de preguntas
 */
export async function revealRoomQuizResults(meetId, io = null) {
    const idStr = String(meetId);
    let room = activeRooms.get(idStr);
    if (!room) room = await getOrCreateRoom(idStr);
    if (!room) return { error: 'Sala Meet no encontrada' };

    room.phase = 'finished';

    // Generar resultados detallados de cada pregunta de la reunión
    const allQuestionsResults = (room.questions || []).map((q, qIdx) => {
        const correctLetter = getCorrectOptionLetter(q);
        const qAnswers = room.answers?.get(qIdx) || new Map();

        const breakdown = { a: 0, b: 0, c: 0, d: 0 };
        qAnswers.forEach((ans) => {
            let opt = String(ans.selectedAnswer || '').trim().toLowerCase();
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
                        timeTakenMs: ans.timeTakenMs
                    });
                } else {
                    incorrectParticipants.push({
                        id: pIdStr,
                        username: p.username,
                        selectedAnswer: ans.selectedAnswer,
                        pointsGained: 0,
                        timeTakenMs: ans.timeTakenMs
                    });
                }
            } else {
                unrespondedParticipants.push({
                    id: pIdStr,
                    username: p.username,
                    selectedAnswer: null,
                    pointsGained: 0
                });
            }
        });

        return {
            questionIndex: qIdx,
            questionText: q.question_text,
            optionA: q.option_a,
            optionB: q.option_b,
            optionC: q.option_c,
            optionD: q.option_d,
            correctAnswer: correctLetter,
            correctAnswerText: q[`option_${correctLetter}`] || '',
            explanation: q.explanation || 'Respuesta bíblica fundamentada.',
            verseReference: q.verse_reference || '',
            breakdown,
            correctParticipants,
            incorrectParticipants,
            unrespondedParticipants
        };
    });

    const quizProg = getRoomQuizProgress(room);
    const finalPodium = (quizProg?.leaderboard && quizProg.leaderboard.length > 0)
        ? quizProg.leaderboard
        : Array.from(room.participants.values()).sort((a, b) => (b.score || 0) - (a.score || 0));

    const totalAttendance = room.allTimeParticipants ? room.allTimeParticipants.size : room.participants.size;

    const resultsPayload = {
        meetId: idStr,
        phase: 'finished',
        totalQuestions: room.questions.length,
        questionsResults: allQuestionsResults,
        podium: finalPodium,
        leaderboard: finalPodium,
        totalJoinedCount: totalAttendance,
        platformOnlineCount: getPlatformOnlineCount()
    };

    room.revealedResults = resultsPayload;

    if (io) {
        io.to(`meet:${idStr}`).emit('meet:phase-changed', { phase: 'finished', meetId: idStr });
        io.emit('meet:phase-changed', { phase: 'finished', meetId: idStr });

        io.to(`meet:${idStr}`).emit('meet:quiz-results-revealed', resultsPayload);
        io.emit('meet:quiz-results-revealed', resultsPayload);

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

    // Acreditar Puntos de Sabiduría a los participantes en la base de datos (solo una vez)
    if (!room.pointsAwarded) {
        room.pointsAwarded = true;
        try {
            const supabase = getDb();
            for (let p of finalPodium) {
                if (p.score > 0) {
                    const { data: u } = await supabase.from('users').select('points').eq('id', p.id).single();
                    const currentPts = (u && u.points) ? u.points : 0;
                    await supabase.from('users').update({ points: currentPts + p.score }).eq('id', p.id);
                }
            }
            // NOTA: NO cambiar status = 'ended' en meetings aquí.
            // La reunión se mantiene activa para que todos vean la tabla de posiciones, podio y revisión.
            // La reunión solo se finaliza cuando el líder presione "Cerrar Reunión para Todos".
            if (io) {
                io.emit('leaderboard-update');
                io.emit('meet:updated');
            }
        } catch (dbErr) {
            console.error('[MeetSocket] Error guardando puntos finales:', dbErr);
        }
    }

    return { success: true, results: resultsPayload };
}

/**
 * Alias de compatibilidad para revelar resultados
 */
export async function revealRoomQuestionResults(meetId, questionIndex = null, io = null) {
    return revealRoomQuizResults(meetId, io);
}

/**
 * Alias de compatibilidad para avanzar
 */
export async function advanceRoomNextQuestion(meetId, io = null) {
    return revealRoomQuizResults(meetId, io);
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
        if (!room?.pointsAwarded && finalPodium.length > 0) {
            if (room) room.pointsAwarded = true;
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

            // Enviar lista sanitizada de preguntas
            const sanitizedQuestions = (room.questions || []).map((q, idx) => ({
                id: q.id || `q_${idx}`,
                question_text: q.question_text,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                time_limit_seconds: q.time_limit_seconds || 25
            }));

            // Calcular estado personal del usuario en el Quiz
            let myAnswersList = [];
            let myCompletedCount = 0;
            let myIsFinished = false;

            if (room.userAnswers && room.userAnswers.has(userIdStr)) {
                const uAnswers = room.userAnswers.get(userIdStr);
                myAnswersList = Array.from(uAnswers.values());
                myCompletedCount = uAnswers.size;
                myIsFinished = sanitizedQuestions.length > 0 && myCompletedCount >= sanitizedQuestions.length;
            }

            const quizProgress = getRoomQuizProgress(room);

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
                currentReader: room.currentReader,
                questionsCount: sanitizedQuestions.length,
                participants: Array.from(room.participants.values()),
                questions: sanitizedQuestions,
                // Datos del Quiz individual y progreso global
                myAnswers: myAnswersList,
                myCompletedCount,
                myIsFinished,
                quizProgress,
                revealedResults: room.revealedResults,
                leaderboard: quizProgress?.leaderboard || [],
                myScore: score,
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

        // 7. ENVIAR RESPUESTA A PREGUNTA EN VIVO (Self-Paced por usuario)
        socket.on('meet:submit-answer', async ({ meetId, questionIndex, selectedAnswer, timeTakenMs, user: payloadUser }) => {
            const userObj = currentUser || payloadUser || socket.data?.user;
            if (!userObj) return;

            const result = await submitRoomAnswer(meetId, questionIndex, selectedAnswer, timeTakenMs, userObj, io);
            if (result && !result.error) {
                socket.emit('meet:answer-received', result);
            }
        });

        // 8. REVELAR RESULTADOS DEL QUIZ (Líder / Admin hace clic en "Mostrar Resultados")
        socket.on('meet:reveal-question-results', async ({ meetId }) => {
            const room = activeRooms.get(String(meetId));
            const isAuthorized = currentUser && (
                (room && String(currentUser.id) === String(room.hostId)) ||
                ['admin', 'superadmin', 'lider', 'leader'].includes((currentUser.role || '').toLowerCase())
            );
            if (!isAuthorized) return;

            await revealRoomQuizResults(meetId, io);
        });

        socket.on('meet:reveal-quiz-results', async ({ meetId }) => {
            const room = activeRooms.get(String(meetId));
            const isAuthorized = currentUser && (
                (room && String(currentUser.id) === String(room.hostId)) ||
                ['admin', 'superadmin', 'lider', 'leader'].includes((currentUser.role || '').toLowerCase())
            );
            if (!isAuthorized) return;

            await revealRoomQuizResults(meetId, io);
        });

        // 9. FINALIZAR / CERRAR REUNIÓN EN VIVO MANUALMENTE (Líder / Admin)
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
