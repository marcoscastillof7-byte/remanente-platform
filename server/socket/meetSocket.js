import { getDb } from '../db/database.js';

// Almacén en memoria de salas activas para latencia 0ms
export const activeRooms = new Map();

// Registro en memoria de sockets y usuarios conectados a la plataforma en tiempo real
const globalPlatformSockets = new Map(); // socketId -> { userId, username, lastPing }

/**
 * Limpia sockets inactivos sin ping reciente para evitar conteos fantasmas
 */
export function cleanupStaleSockets() {
    const now = Date.now();
    for (const [socketId, info] of globalPlatformSockets.entries()) {
        if (now - (info.lastPing || 0) > 45000) {
            globalPlatformSockets.delete(socketId);
        }
    }
}

/**
 * Devuelve la lista detallada de usuarios actualmente conectados en vivo
 */
export function getPlatformOnlineUsers() {
    cleanupStaleSockets();
    const usersMap = new Map();
    for (const info of globalPlatformSockets.values()) {
        if (info.userId) {
            usersMap.set(String(info.userId), {
                id: info.userId,
                username: info.username,
                role: info.role || 'user',
                points: info.points || 0,
                lastPing: info.lastPing
            });
        }
    }
    return Array.from(usersMap.values());
}

let cachedPlatformStats = { onlineCount: 1, users: [], lastUpdated: 0 };

/**
 * Devuelve las estadísticas completas de usuarios conectados (Sockets + Supabase DB last_active)
 */
export async function getPlatformOnlineStats() {
    cleanupStaleSockets();
    const now = Date.now();
    
    // Cache de 3 segundos para responder instantáneamente y evitar saturar la base de datos
    if (now - cachedPlatformStats.lastUpdated < 3000 && cachedPlatformStats.users.length > 0) {
        return cachedPlatformStats;
    }

    const socketUsers = getPlatformOnlineUsers();
    const usersMap = new Map();

    for (const u of socketUsers) {
        if (u.id) {
            usersMap.set(String(u.id), {
                ...u,
                source: 'socket'
            });
        }
    }

    try {
        const supabase = getDb();
        if (supabase) {
            // Usuarios activos en los últimos 4 minutos en Supabase
            const fourMinAgo = new Date(now - 4 * 60 * 1000).toISOString();
            const { data: dbActive, error } = await supabase
                .from('users')
                .select('id, username, role, points, last_active')
                .gte('last_active', fourMinAgo)
                .order('last_active', { ascending: false });

            if (!error && Array.isArray(dbActive)) {
                for (const u of dbActive) {
                    const idStr = String(u.id);
                    if (!usersMap.has(idStr)) {
                        usersMap.set(idStr, {
                            id: u.id,
                            username: u.username,
                            role: u.role || 'user',
                            points: u.points || 0,
                            lastActive: u.last_active,
                            source: 'db'
                        });
                    }
                }
            }
        }
    } catch (dbErr) {
        // En caso de fallo con Supabase, continuar con sockets
    }

    // Contar también sockets anónimos
    let anonymousCount = 0;
    for (const info of globalPlatformSockets.values()) {
        if (!info.userId) {
            anonymousCount++;
        }
    }

    const mergedUsers = Array.from(usersMap.values());
    const onlineCount = Math.max(1, mergedUsers.length + anonymousCount);

    cachedPlatformStats = {
        onlineCount,
        users: mergedUsers,
        lastUpdated: now
    };

    return cachedPlatformStats;
}

/**
 * Devuelve la cantidad de usuarios únicos actualmente conectados a la plataforma
 */
export function getPlatformOnlineCount() {
    cleanupStaleSockets();
    const uniqueUsers = new Set();
    let anonymousCount = 0;
    for (const info of globalPlatformSockets.values()) {
        if (info.userId) {
            uniqueUsers.add(String(info.userId));
        } else {
            anonymousCount++;
        }
    }
    const socketTotal = uniqueUsers.size + anonymousCount;
    return Math.max(1, Math.max(socketTotal, cachedPlatformStats.onlineCount || 1));
}

/**
 * Comprueba si un usuario tiene privilegios de líder o administrador
 */
export function isUserLeaderOrAdmin(role, username) {
    const r = (role || '').toLowerCase();
    const u = (username || '').toLowerCase();
    return ['admin', 'superadmin', 'lider', 'leader'].includes(r) || u === 'marcos';
}

/**
 * Emite las estadísticas de usuarios conectados a toda la plataforma
 * Solo envía la lista detallada de identidades a líderes y administradores
 */
export async function broadcastPlatformOnlineStats(io) {
    if (!io) return;
    try {
        const stats = await getPlatformOnlineStats();
        const fullPayload = {
            onlineCount: stats.onlineCount,
            users: stats.users,
            timestamp: Date.now()
        };
        const publicPayload = {
            onlineCount: stats.onlineCount,
            users: [],
            timestamp: Date.now()
        };

        if (io.sockets?.sockets) {
            for (const [sockId, socket] of io.sockets.sockets.entries()) {
                const info = globalPlatformSockets.get(sockId);
                const role = info?.role || socket.data?.user?.role;
                const username = info?.username || socket.data?.user?.username;
                const isPrivileged = isUserLeaderOrAdmin(role, username);
                socket.emit('platform:online-stats', isPrivileged ? fullPayload : publicPayload);
            }
        } else {
            io.emit('platform:online-stats', publicPayload);
        }
    } catch (e) {
        cleanupStaleSockets();
        const onlineCount = getPlatformOnlineCount();
        const fullUsers = getPlatformOnlineUsers();
        const publicPayload = {
            onlineCount,
            users: [],
            timestamp: Date.now()
        };
        if (io.sockets?.sockets) {
            for (const [sockId, socket] of io.sockets.sockets.entries()) {
                const info = globalPlatformSockets.get(sockId);
                const role = info?.role || socket.data?.user?.role;
                const username = info?.username || socket.data?.user?.username;
                const isPrivileged = isUserLeaderOrAdmin(role, username);
                socket.emit('platform:online-stats', isPrivileged ? { onlineCount, users: fullUsers, timestamp: Date.now() } : publicPayload);
            }
        } else {
            io.emit('platform:online-stats', publicPayload);
        }
    }
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
        phase: meta.phase || (meeting.status === 'live' ? 'reading' : (meeting.status || 'scheduled')),
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
        revealedResults: meta.revealedResults || null,
        revealTimer: null
    };

    // Restaurar respuestas previas si el servidor se reinició o hubo reconexión
    if (meta.savedUserAnswers && typeof meta.savedUserAnswers === 'object') {
        Object.entries(meta.savedUserAnswers).forEach(([uId, ansObj]) => {
            const ansMap = new Map();
            let totalScore = 0;
            Object.entries(ansObj).forEach(([qIdx, ans]) => {
                const qNum = Number(qIdx);
                ansMap.set(qNum, ans);
                totalScore += (ans.points || 0);

                let qAnsMap = roomState.answers.get(qNum);
                if (!qAnsMap) {
                    qAnsMap = new Map();
                    roomState.answers.set(qNum, qAnsMap);
                }
                qAnsMap.set(String(uId), ans);
            });
            roomState.userAnswers.set(String(uId), ansMap);

            if (!roomState.participants.has(String(uId))) {
                roomState.participants.set(String(uId), {
                    id: String(uId),
                    username: ansMap.values().next().value?.username || 'Participante',
                    score: totalScore,
                    connected: false
                });
            }
        });
    }

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
        let calculatedScore = 0;
        let totalTimeTakenMs = 0;
        uAnswers.forEach(ans => {
            if (ans.isCorrect) correctCount++;
            calculatedScore += (ans.points || 0);
            totalTimeTakenMs += (ans.timeTakenMs || 0);
        });

        const effectiveScore = Math.max(p.score || 0, calculatedScore);
        const avgTimeSec = completedCount > 0 ? parseFloat(((totalTimeTakenMs / completedCount) / 1000).toFixed(1)) : 0;

        return {
            id: uIdStr,
            username: p.username || 'Participante',
            role: p.role,
            isHost: p.isHost,
            score: effectiveScore,
            completedCount,
            correctCount,
            totalTimeTakenMs,
            avgTimeSec,
            totalQuestions,
            isFinished,
            connected: p.connected !== false
        };
    });

    const finishedCount = participantsList.filter(p => p.isFinished).length;
    const totalParticipants = participantsList.length;
    const allFinished = totalParticipants > 0 && finishedCount >= totalParticipants;

    // Ordenamiento oficial de posicionamiento con desempate infalible
    const liveLeaderboard = [...participantsList].sort((a, b) => {
        // 1. Mayor puntuación
        if ((b.score || 0) !== (a.score || 0)) {
            return (b.score || 0) - (a.score || 0);
        }
        // 2. Mayor número de aciertos
        if ((b.correctCount || 0) !== (a.correctCount || 0)) {
            return (b.correctCount || 0) - (a.correctCount || 0);
        }
        // 3. Menor tiempo total empleado (más rápido)
        return (a.totalTimeTakenMs || 0) - (b.totalTimeTakenMs || 0);
    }).map((p, idx) => ({ ...p, rank: idx + 1 }));

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
        correct_answer: getCorrectOptionLetter(q),
        correctAnswer: getCorrectOptionLetter(q),
        explanation: q.explanation || 'Respuesta bíblica fundamentada en las Sagradas Escrituras.',
        verse_reference: q.verse_reference || q.verseReference || '',
        verseReference: q.verse_reference || q.verseReference || '',
        time_limit_seconds: q.time_limit_seconds || 25
    }));

    // Persistir fase quiz en Supabase meetings
    try {
        const { data: currentMeet } = await supabase.from('meetings').select('description').eq('id', idStr).single();
        let currentMeta = {};
        try { currentMeta = JSON.parse(currentMeet?.description || '{}'); } catch {}
        currentMeta.phase = 'quiz';
        currentMeta.questions = sanitizedQuestions;
        currentMeta.revealedResults = null;
        await supabase.from('meetings').update({ description: JSON.stringify(currentMeta) }).eq('id', idStr);
    } catch (persErr) {
        console.error('[meetSocket] Error persistiendo phase quiz:', persErr);
    }

    const progress = getRoomQuizProgress(room);

    if (io) {
        io.to(`meet:${idStr}`).emit('meet:phase-changed', { phase: 'quiz', meetId: idStr, questions: sanitizedQuestions });
        io.to(`meet:${idStr}`).emit('meet:quiz-started', {
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

const progressThrottleTimers = new Map();

/**
 * Emite la actualización de progreso del quiz a la sala correspondiente
 * con micro-throttle de 100ms para evitar tormentas de eventos cuando 15+ personas
 * responden simultáneamente, garantizando 0ms de lag y máxima fluidez en todos los dispositivos.
 */
export function scheduleRoomProgressBroadcast(io, idStr, room, immediate = false) {
    if (!io || !idStr || !room) return;
    
    if (immediate) {
        if (progressThrottleTimers.has(idStr)) {
            clearTimeout(progressThrottleTimers.get(idStr));
            progressThrottleTimers.delete(idStr);
        }
        const progress = getRoomQuizProgress(room);
        if (progress) {
            io.to(`meet:${idStr}`).emit('meet:quiz-progress-updated', progress);
            if (progress.allFinished) {
                io.to(`meet:${idStr}`).emit('meet:all-participants-finished', progress);
            }
        }
        return;
    }

    if (progressThrottleTimers.has(idStr)) return;

    const timer = setTimeout(() => {
        progressThrottleTimers.delete(idStr);
        const progress = getRoomQuizProgress(room);
        if (progress) {
            io.to(`meet:${idStr}`).emit('meet:quiz-progress-updated', progress);
            if (progress.allFinished) {
                io.to(`meet:${idStr}`).emit('meet:all-participants-finished', progress);
            }
        }
    }, 100);
    progressThrottleTimers.set(idStr, timer);
}

const pendingPersistTimers = new Map();

/**
 * Guarda en lote las respuestas y participantes de la sala en Supabase.
 * Diseñado específicamente para que 15+ personas respondiendo concurrentemente
 * no saturen la base de datos ni provoquen colisiones o carreras.
 */
export async function flushRoomPersist(room, idStr) {
    if (!room || !idStr) return;
    if (pendingPersistTimers.has(idStr)) {
        clearTimeout(pendingPersistTimers.get(idStr));
        pendingPersistTimers.delete(idStr);
    }
    try {
        const supabase = getDb();
        const { data: currentMeet } = await supabase.from('meetings').select('description').eq('id', idStr).single();
        let currentMeta = {};
        try { currentMeta = JSON.parse(currentMeet?.description || '{}'); } catch {}
        if (!currentMeta.savedUserAnswers) currentMeta.savedUserAnswers = {};
        
        if (room.userAnswers) {
            room.userAnswers.forEach((ansMap, uId) => {
                const uIdStr = String(uId);
                if (!currentMeta.savedUserAnswers[uIdStr]) currentMeta.savedUserAnswers[uIdStr] = {};
                ansMap.forEach((entry, qIdx) => {
                    currentMeta.savedUserAnswers[uIdStr][qIdx] = entry;
                });
            });
        }
        if (room.participants) {
            if (!currentMeta.savedParticipants) currentMeta.savedParticipants = {};
            room.participants.forEach((p, uId) => {
                const uIdStr = String(uId);
                currentMeta.savedParticipants[uIdStr] = {
                    id: p.id,
                    username: p.username,
                    score: p.score || 0,
                    role: p.role || 'user',
                    isHost: p.isHost || false
                };
            });
        }
        await supabase.from('meetings').update({ description: JSON.stringify(currentMeta) }).eq('id', idStr);
    } catch (err) {
        console.warn('[meetSocket] Error en flushRoomPersist:', err.message);
    }
}

export function scheduleRoomPersist(room, idStr) {
    if (!room || !idStr) return;
    if (pendingPersistTimers.has(idStr)) return;
    const timer = setTimeout(() => {
        pendingPersistTimers.delete(idStr);
        flushRoomPersist(room, idStr);
    }, 400); // 400ms debounce
    pendingPersistTimers.set(idStr, timer);
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
        const isFinished = uAnswers.size >= room.questions.length;
        scheduleRoomProgressBroadcast(io, idStr, room, isFinished && progress.allFinished);
    }

    // Persistencia continua por lotes (debounce 400ms) para blindar contra recarga y caídas sin colisiones
    scheduleRoomPersist(room, idStr);

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

    // Asegurar que todas las respuestas pendientes se consoliden en la base de datos
    await flushRoomPersist(room, idStr);

    // 1. Preparar lista completa de preguntas con respuestas y explicaciones reales
    const fullQuestions = (room.questions || []).map((q, idx) => ({
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
        correct_answer: getCorrectOptionLetter(q),
        correctAnswer: getCorrectOptionLetter(q),
        explanation: q.explanation || 'Respuesta bíblica fundamentada en las Sagradas Escrituras.',
        verse_reference: q.verse_reference || q.verseReference || '',
        verseReference: q.verse_reference || q.verseReference || '',
        time_limit_seconds: q.time_limit_seconds || 25
    }));

    // 2. Generar resultados y estadísticas detalladas por cada pregunta
    const allQuestionsResults = fullQuestions.map((q, qIdx) => {
        const correctLetter = q.correct_answer;
        const qAnswers = room.answers?.get(qIdx) || new Map();

        const breakdown = { a: 0, b: 0, c: 0, d: 0, timeout: 0 };
        qAnswers.forEach((ans) => {
            let opt = String(ans.selectedAnswer || '').trim().toLowerCase();
            if (opt === 'timeout') {
                breakdown.timeout = (breakdown.timeout || 0) + 1;
                return;
            }
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
                        username: p.username || 'Participante',
                        selectedAnswer: ans.selectedAnswer,
                        pointsGained: ans.points,
                        timeTakenMs: ans.timeTakenMs
                    });
                } else {
                    incorrectParticipants.push({
                        id: pIdStr,
                        username: p.username || 'Participante',
                        selectedAnswer: ans.selectedAnswer,
                        pointsGained: 0,
                        timeTakenMs: ans.timeTakenMs
                    });
                }
            } else {
                unrespondedParticipants.push({
                    id: pIdStr,
                    username: p.username || 'Participante',
                    selectedAnswer: null,
                    pointsGained: 0
                });
            }
        });

        const totalAnswered = correctParticipants.length + incorrectParticipants.length;
        const correctPercentage = totalAnswered > 0 
            ? Math.round((correctParticipants.length / totalAnswered) * 100) 
            : 0;

        return {
            ...q,
            questionIndex: qIdx,
            correctAnswerText: q[`option_${correctLetter}`] || q[`option${correctLetter.toUpperCase()}`] || '',
            breakdown,
            totalAnswered,
            correctCount: correctParticipants.length,
            incorrectCount: incorrectParticipants.length,
            unrespondedCount: unrespondedParticipants.length,
            correctPercentage,
            correctParticipants,
            incorrectParticipants,
            unrespondedParticipants
        };
    });

    // 3. Serializar todas las respuestas de todos los participantes (incluso los que no terminaron)
    const allUserAnswers = {};
    room.participants.forEach((p, uId) => {
        const uIdStr = String(uId);
        allUserAnswers[uIdStr] = {};
        const ansMap = room.userAnswers?.get(uIdStr) || new Map();

        fullQuestions.forEach((targetQ, qIdx) => {
            if (ansMap.has(qIdx)) {
                const ans = ansMap.get(qIdx);
                allUserAnswers[uIdStr][qIdx] = {
                    ...ans,
                    correctAnswer: targetQ.correct_answer,
                    explanation: targetQ.explanation || '',
                    verseReference: targetQ.verse_reference || ''
                };
            } else {
                allUserAnswers[uIdStr][qIdx] = {
                    userId: uIdStr,
                    username: p.username || 'Participante',
                    questionIndex: qIdx,
                    selectedAnswer: null,
                    isCorrect: false,
                    points: 0,
                    isUnanswered: true,
                    correctAnswer: targetQ.correct_answer,
                    explanation: targetQ.explanation || '',
                    verseReference: targetQ.verse_reference || ''
                };
            }
        });
    });

    const quizProg = getRoomQuizProgress(room);
    const finalPodium = (quizProg?.leaderboard && quizProg.leaderboard.length > 0)
        ? quizProg.leaderboard
        : Array.from(room.participants.values()).sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, idx) => ({ ...p, rank: idx + 1 }));

    // 4. Acreditar Puntos de Sabiduría a los participantes en la base de datos (solo una vez)
    if (!room.pointsAwarded) {
        room.pointsAwarded = true;
        try {
            const supabase = getDb();
            for (let p of finalPodium) {
                if (p.score > 0) {
                    const { data: u } = await supabase.from('users').select('points').eq('id', p.id).single();
                    const currentPts = (u && u.points) ? u.points : 0;
                    const newPts = currentPts + p.score;
                    await supabase.from('users').update({ points: newPts }).eq('id', p.id);
                    p.totalPlatformPoints = newPts;
                }
            }
            if (io) {
                io.emit('leaderboard-update');
                io.emit('meet:updated');
            }
        } catch (dbErr) {
            console.error('[MeetSocket] Error guardando puntos finales:', dbErr);
        }
    }

    const totalAttendance = room.allTimeParticipants ? room.allTimeParticipants.size : room.participants.size;

    const resultsPayload = {
        meetId: idStr,
        phase: 'finished',
        totalQuestions: fullQuestions.length,
        fullQuestions,
        questionsResults: allQuestionsResults,
        allUserAnswers,
        podium: finalPodium,
        leaderboard: finalPodium,
        totalJoinedCount: totalAttendance,
        platformOnlineCount: getPlatformOnlineCount()
    };

    room.revealedResults = resultsPayload;

    // Persistir fase finished y resultados en Supabase meetings
    try {
        const supabase = getDb();
        const { data: dbMeet } = await supabase.from('meetings').select('description').eq('id', idStr).single();
        let meta = {};
        try { meta = JSON.parse(dbMeet?.description || '{}'); } catch {}
        meta.phase = 'finished';
        meta.revealedResults = resultsPayload;
        await supabase.from('meetings').update({ description: JSON.stringify(meta) }).eq('id', idStr);
    } catch (dbErr) {
        console.error('[meetSocket] Error guardando revealedResults en BD:', dbErr);
    }

    if (io) {
        // Notificar cambio de fase a 'finished' a la sala
        io.to(`meet:${idStr}`).emit('meet:phase-changed', { phase: 'finished', meetId: idStr });

        // Emitir resultados completos para todos los participantes de la sala
        io.to(`meet:${idStr}`).emit('meet:quiz-results-revealed', resultsPayload);

        io.to(`meet:${idStr}`).emit('meet:final-podium', {
            meetId: idStr,
            podium: finalPodium,
            totalJoinedCount: totalAttendance,
            platformOnlineCount: getPlatformOnlineCount()
        });
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
        io.to(`meet:${idStr}`).emit('meet:session-ended', endedPayload);
        io.to(`meet:${idStr}`).emit('meet:final-podium', { 
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
                    role: userData.role || 'user',
                    points: userData.points || 0,
                    lastPing: Date.now()
                });
                socket.data = socket.data || {};
                socket.data.user = userData;
                broadcastPlatformOnlineStats(io);
            }
        });

        // Ping de latencia y presencia activa desde el frontend
        socket.on('platform:ping', () => {
            const info = globalPlatformSockets.get(socket.id);
            if (info) {
                info.lastPing = Date.now();
            } else {
                globalPlatformSockets.set(socket.id, {
                    userId: currentUser ? String(currentUser.id) : null,
                    username: currentUser ? currentUser.username : null,
                    role: currentUser ? currentUser.role : 'user',
                    points: currentUser ? currentUser.points : 0,
                    lastPing: Date.now()
                });
            }

            const currentInfo = globalPlatformSockets.get(socket.id);
            const role = currentInfo?.role || socket.data?.user?.role || currentUser?.role;
            const username = currentInfo?.username || socket.data?.user?.username || currentUser?.username;
            const isPrivileged = isUserLeaderOrAdmin(role, username);

            socket.emit('platform:pong', { 
                onlineCount: getPlatformOnlineCount(),
                users: isPrivileged ? getPlatformOnlineUsers() : []
            });
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
            
            // Si el usuario ya estaba, preservar score y cancelar cualquier temporizador de desconexión previo
            const existing = room.participants.get(userIdStr);
            if (existing && existing.disconnectTimer) {
                clearTimeout(existing.disconnectTimer);
                existing.disconnectTimer = null;
            }
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

            // Enviar lista completa de preguntas para renderizado y validación exacta
            const sanitizedQuestions = (room.questions || []).map((q, idx) => ({
                id: q.id || `q_${idx}`,
                question_text: q.question_text || q.questionText,
                questionText: q.question_text || q.questionText,
                option_a: q.option_a || q.optionA,
                optionA: q.option_a || q.optionA,
                option_b: q.option_b || q.optionB,
                optionB: q.option_b || q.optionB,
                option_c: q.option_c || q.optionC,
                option_c: q.option_c || q.optionC,
                option_d: q.option_d || q.optionD,
                optionD: q.option_d || q.optionD,
                correct_answer: getCorrectOptionLetter(q),
                correctAnswer: getCorrectOptionLetter(q),
                explanation: q.explanation || 'Respuesta bíblica fundamentada en las Sagradas Escrituras.',
                verse_reference: q.verse_reference || q.verseReference || '',
                verseReference: q.verse_reference || q.verseReference || '',
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
                connectedCount: Array.from(room.participants.values()).filter(p => p.connected !== false).length,
                totalJoinedCount: room.allTimeParticipants ? room.allTimeParticipants.size : room.participants.size,
                peakAttendance: room.peakAttendance || room.participants.size,
                platformOnlineCount: getPlatformOnlineCount()
            });

            // Avisar a los demás
            const activeCount = Array.from(room.participants.values()).filter(p => p.connected !== false).length;
            io.to(`meet:${currentMeetId}`).emit('meet:participants-updated', {
                participants: Array.from(room.participants.values()),
                connectedCount: activeCount,
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

        // 8.1. CAMBIAR FASE DE LA REUNIÓN (Líder / Admin reanuda lectura o cambia fase)
        socket.on('meet:change-phase', async ({ meetId, phase }) => {
            const idStr = String(meetId);
            const room = activeRooms.get(idStr);
            const isAuthorized = currentUser && (
                ['admin', 'superadmin', 'lider', 'leader'].includes((currentUser.role || '').toLowerCase()) ||
                (room && String(currentUser.id) === String(room.hostId))
            );
            if (!isAuthorized) return;

            if (room) {
                room.phase = phase;
                if (phase === 'reading') {
                    room.revealedResults = null;
                }
            }

            try {
                const supabase = getDb();
                const { data: currentMeet } = await supabase.from('meetings').select('description').eq('id', idStr).single();
                let currentMeta = {};
                try { currentMeta = JSON.parse(currentMeet?.description || '{}'); } catch {}
                currentMeta.phase = phase;
                if (phase === 'reading') {
                    currentMeta.revealedResults = null;
                }
                await supabase.from('meetings').update({ description: JSON.stringify(currentMeta) }).eq('id', idStr);
            } catch (e) {}

            io.to(`meet:${idStr}`).emit('meet:phase-changed', { meetId: idStr, phase });
            io.emit('meet:phase-changed', { meetId: idStr, phase });
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

        // 11. SALIR VOLUNTARIAMENTE DE LA SALA MEET
        socket.on('meet:leave', ({ meetId, user }) => {
            const idStr = String(meetId || currentMeetId);
            const targetUser = user || currentUser;
            const room = activeRooms.get(idStr);
            if (room && targetUser) {
                const userIdStr = String(targetUser.id);
                const p = room.participants.get(userIdStr);
                if (p) {
                    if (p.disconnectTimer) {
                        clearTimeout(p.disconnectTimer);
                        p.disconnectTimer = null;
                    }
                    p.connected = false;
                    p.socketDisconnected = true;
                    p.lastDisconnectedAt = Date.now();
                }
                room.handsRaised.delete(userIdStr);
                socket.leave(`meet:${idStr}`);

                const activeCount = Array.from(room.participants.values()).filter(part => part.connected !== false).length;
                io.to(`meet:${idStr}`).emit('meet:participants-updated', {
                    participants: Array.from(room.participants.values()),
                    connectedCount: activeCount,
                    totalCount: room.participants.size,
                    totalJoinedCount: room.allTimeParticipants ? room.allTimeParticipants.size : room.participants.size,
                    peakAttendance: room.peakAttendance || room.participants.size,
                    platformOnlineCount: getPlatformOnlineCount()
                });
            }
        });

        // 12. DESCONEXIÓN CON PROTECCIÓN PARA RECONEXIONES MÓVILES
        socket.on('disconnect', () => {
            globalPlatformSockets.delete(socket.id);
            broadcastPlatformOnlineStats(io);

            if (currentMeetId && currentUser) {
                const room = activeRooms.get(currentMeetId);
                if (room) {
                    const userIdStr = String(currentUser.id);
                    const p = room.participants.get(userIdStr);
                    // Solo activar período de gracia si coincide el socket desconectado
                    if (p && p.socketId === socket.id) {
                        p.socketDisconnected = true;
                        p.lastDisconnectedAt = Date.now();
                        
                        // Período de gracia de 35s antes de dar por desconectado
                        if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
                        p.disconnectTimer = setTimeout(() => {
                            if (p.socketDisconnected && p.socketId === socket.id) {
                                p.connected = false;
                                room.handsRaised.delete(userIdStr);

                                const activeCount = Array.from(room.participants.values()).filter(part => part.connected !== false).length;
                                io.to(`meet:${currentMeetId}`).emit('meet:participants-updated', {
                                    participants: Array.from(room.participants.values()),
                                    connectedCount: activeCount,
                                    totalCount: room.participants.size,
                                    totalJoinedCount: room.allTimeParticipants ? room.allTimeParticipants.size : room.participants.size,
                                    peakAttendance: room.peakAttendance || room.participants.size,
                                    platformOnlineCount: getPlatformOnlineCount()
                                });
                            }
                        }, 35000);
                    }
                }
            }
        });
    });
}
