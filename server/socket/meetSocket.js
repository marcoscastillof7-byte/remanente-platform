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
    const room = activeRooms.get(String(meetId));
    if (room) {
        room.status = 'ended';
        room.phase = 'finished';
        activeRooms.delete(String(meetId));
    }
}

/**
 * Limpia y finaliza todas las salas activas en memoria
 */
export function endAllActiveRooms() {
    for (const [id, room] of activeRooms.entries()) {
        room.status = 'ended';
        room.phase = 'finished';
    }
    activeRooms.clear();
}

/**
 * Obtiene o inicializa el estado de una sala Meet
 */
async function getOrCreateRoom(meetId) {
    if (activeRooms.has(meetId)) {
        return activeRooms.get(meetId);
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
        meetId,
        title: meeting.title,
        hostId: meeting.host_id,
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
        participants: new Map(), // userId -> { id, username, score, handRaised, isHost, avatar }
        allTimeParticipants: new Map(), // userId -> { id, username, role, firstJoinedAt }
        peakAttendance: 0,
        answers: new Map(), // questionIndex -> Map(userId -> { selectedAnswer, isCorrect, points, timeTakenMs })
        handsRaised: new Set(),
        currentReader: null,
        revealedResults: null
    };

    activeRooms.set(meetId, roomState);
    return roomState;
}

function revealQuestionResults(room, questionIndex, io) {
    if (!room) return;
    if (room.revealTimer) {
        clearTimeout(room.revealTimer);
        room.revealTimer = null;
    }
    const q = room.questions[questionIndex];
    if (!q) return;

    const qAnswers = room.answers.get(questionIndex) || new Map();
    const breakdown = { a: 0, b: 0, c: 0, d: 0 };
    qAnswers.forEach((ans) => {
        const opt = String(ans.selectedAnswer || '').trim().toLowerCase();
        if (breakdown[opt] !== undefined) {
            breakdown[opt]++;
        }
    });

    // Clasificar detalladamente a todos los participantes: Correctos, Incorrectos y Sin responder
    const correctParticipants = [];
    const incorrectParticipants = [];
    const unrespondedParticipants = [];

    room.participants.forEach((p) => {
        const ans = qAnswers.get(p.id);
        if (ans) {
            if (ans.isCorrect) {
                correctParticipants.push({
                    id: p.id,
                    username: p.username,
                    selectedAnswer: ans.selectedAnswer,
                    pointsGained: ans.points,
                    timeTakenMs: ans.timeTakenMs,
                    totalScore: p.score || 0
                });
            } else {
                incorrectParticipants.push({
                    id: p.id,
                    username: p.username,
                    selectedAnswer: ans.selectedAnswer,
                    pointsGained: 0,
                    timeTakenMs: ans.timeTakenMs,
                    totalScore: p.score || 0
                });
            }
        } else {
            unrespondedParticipants.push({
                id: p.id,
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
        questionIndex,
        correctAnswer: q.correct_answer,
        explanation: q.explanation || 'Respuesta bíblica fundamentada.',
        verseReference: q.verse_reference || '',
        breakdown,
        correctParticipants,
        incorrectParticipants,
        unrespondedParticipants,
        leaderboard,
        hasNextQuestion: (questionIndex + 1) < room.questions.length,
        totalQuestions: room.questions.length
    };

    room.revealedResults = resultsPayload;
    io.to(`meet:${room.meetId}`).emit('meet:question-results', resultsPayload);
}

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
                    userId: userData.id,
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

            // Actualizar identificación global en plataforma
            globalPlatformSockets.set(socket.id, {
                userId: user.id,
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

            const isHost = String(user.id) === String(room.hostId) || user.role === 'admin' || user.role === 'superadmin';
            
            // Si el usuario ya estaba, preservar score
            const existing = room.participants.get(user.id);
            const score = existing ? existing.score : 0;

            room.participants.set(user.id, {
                id: user.id,
                username: user.username,
                role: user.role,
                isHost,
                score,
                handRaised: room.handsRaised.has(user.id),
                socketId: socket.id
            });

            // Registrar en el histórico de asistencia total de este Meet
            if (!room.allTimeParticipants) {
                room.allTimeParticipants = new Map();
            }
            room.allTimeParticipants.set(user.id, {
                id: user.id,
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
                // Solo revelar respuestas si el usuario es host o ya pasó la pregunta
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
                const questionAnswers = room.answers.get(room.currentQuestionIndex) || new Map();
                const answeredParticipants = [];
                const pendingParticipants = [];

                room.participants.forEach((p) => {
                    const ans = questionAnswers.get(p.id);
                    if (ans) {
                        answeredParticipants.push({
                            id: p.id,
                            username: p.username,
                            score: p.score || 0,
                            isCorrect: ans.isCorrect,
                            selectedAnswer: ans.selectedAnswer,
                            points: ans.points,
                            timeTakenMs: ans.timeTakenMs
                        });
                    } else {
                        pendingParticipants.push({
                            id: p.id,
                            username: p.username,
                            score: p.score || 0
                        });
                    }
                });

                currentAnswerStatus = {
                    questionIndex: room.currentQuestionIndex,
                    answeredCount: questionAnswers.size,
                    totalParticipants: room.participants.size,
                    answeredParticipants,
                    pendingParticipants,
                    allAnswered: pendingParticipants.length === 0 && room.participants.size > 0,
                    leaderboard: sortedLeaderboard
                };

                const myAns = questionAnswers.get(user.id);
                if (myAns) {
                    myHasAnswered = true;
                    mySelectedAnswer = myAns.selectedAnswer;
                }

                if (room.questionStartTime && room.questions[room.currentQuestionIndex]) {
                    const limitSec = room.questions[room.currentQuestionIndex].time_limit_seconds || 25;
                    const elapsed = Math.floor((Date.now() - room.questionStartTime) / 1000);
                    currentRemainingTime = Math.max(0, limitSec - elapsed);
                }
            }

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

            const isRaised = room.handsRaised.has(currentUser.id);
            if (isRaised) {
                room.handsRaised.delete(currentUser.id);
            } else {
                room.handsRaised.add(currentUser.id);
            }

            const p = room.participants.get(currentUser.id);
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

        // 6. INICIAR FASE DE QUIZ / PREGUNTAS (Solo Líder/Host)
        socket.on('meet:start-quiz', ({ meetId }) => {
            const room = activeRooms.get(String(meetId));
            if (!room) return;
            const isAuthorized = currentUser && (
                String(currentUser.id) === String(room.hostId) ||
                ['admin', 'superadmin', 'lider', 'leader'].includes((currentUser.role || '').toLowerCase())
            );
            if (!isAuthorized) return;

            if (!room.questions || room.questions.length === 0) {
                socket.emit('meet:error', { 
                    message: 'Esta sala no tiene preguntas cargadas. Puedes añadir preguntas bíblicas al editar o crear el Meet.' 
                });
                return;
            }

            room.phase = 'quiz';
            room.currentQuestionIndex = 0;
            room.questionStartTime = Date.now();
            room.revealedResults = null;
            room.answers.set(0, new Map());

            const q = room.questions[0];
            const leaderboard = Array.from(room.participants.values())
                .sort((a, b) => (b.score || 0) - (a.score || 0));

            io.to(`meet:${meetId}`).emit('meet:phase-changed', { phase: 'quiz' });
            io.to(`meet:${meetId}`).emit('meet:question-started', {
                questionIndex: 0,
                totalQuestions: room.questions.length,
                question: {
                    id: q.id || 'q_0',
                    question_text: q.question_text,
                    option_a: q.option_a,
                    option_b: q.option_b,
                    option_c: q.option_c,
                    option_d: q.option_d,
                    time_limit_seconds: q.time_limit_seconds || 25
                },
                leaderboard
            });

            // Estado de respuestas inicial: 0 respondieron, todos pendientes
            io.to(`meet:${meetId}`).emit('meet:answer-status-updated', {
                questionIndex: 0,
                answeredCount: 0,
                totalParticipants: room.participants.size,
                answeredParticipants: [],
                pendingParticipants: Array.from(room.participants.values()).map(p => ({
                    id: p.id,
                    username: p.username,
                    score: p.score || 0
                })),
                allAnswered: false,
                leaderboard
            });

            if (room.revealTimer) clearTimeout(room.revealTimer);
            const timeLimitSec = (q.time_limit_seconds || 25) + 3;
            room.revealTimer = setTimeout(() => {
                if (room.phase === 'quiz' && room.currentQuestionIndex === 0 && !room.revealedResults) {
                    revealQuestionResults(room, 0, io);
                }
            }, timeLimitSec * 1000);
        });

        // 7. ENVIAR RESPUESTA A PREGUNTA EN VIVO
        socket.on('meet:submit-answer', ({ meetId, questionIndex, selectedAnswer, timeTakenMs }) => {
            const room = activeRooms.get(String(meetId));
            if (!room || !currentUser) return;
            if (room.phase !== 'quiz' || room.currentQuestionIndex !== questionIndex) return;

            let questionAnswers = room.answers.get(questionIndex);
            if (!questionAnswers) {
                questionAnswers = new Map();
                room.answers.set(questionIndex, questionAnswers);
            }

            // Si ya respondió esta pregunta, ignorar duplicado
            if (questionAnswers.has(currentUser.id)) return;

            const q = room.questions[questionIndex];
            const isCorrect = q && String(q.correct_answer || '').trim().toLowerCase() === String(selectedAnswer || '').trim().toLowerCase();

            // Puntuación estilo Kahoot: Base 50 + velocidad hasta 50 puntos adicionales
            let points = 0;
            if (isCorrect) {
                const limitMs = (q.time_limit_seconds || 25) * 1000;
                const safeTimeMs = Math.max(0, Math.min(limitMs, Number(timeTakenMs) || 1000));
                const timeLeftRatio = Math.max(0, Math.min(1, 1 - (safeTimeMs / limitMs)));
                const speedBonus = Math.round(timeLeftRatio * 50);
                points = 50 + speedBonus;
            }

            questionAnswers.set(currentUser.id, {
                userId: currentUser.id,
                username: currentUser.username,
                selectedAnswer,
                isCorrect,
                points,
                timeTakenMs: Number(timeTakenMs) || 0
            });

            // Actualizar score acumulado del participante
            const participant = room.participants.get(currentUser.id);
            if (participant) {
                participant.score = (participant.score || 0) + points;
            }

            // Confirmación privada para el participante que respondió
            socket.emit('meet:answer-received', { isCorrect, points, selectedAnswer });

            // Calcular listas de quiénes ya respondieron y quiénes faltan en tiempo real
            const answeredParticipants = [];
            const pendingParticipants = [];

            room.participants.forEach((p) => {
                const ans = questionAnswers.get(p.id);
                if (ans) {
                    answeredParticipants.push({
                        id: p.id,
                        username: p.username,
                        score: p.score || 0,
                        isCorrect: ans.isCorrect,
                        selectedAnswer: ans.selectedAnswer,
                        points: ans.points,
                        timeTakenMs: ans.timeTakenMs
                    });
                } else {
                    pendingParticipants.push({
                        id: p.id,
                        username: p.username,
                        score: p.score || 0
                    });
                }
            });

            const currentLeaderboard = Array.from(room.participants.values())
                .sort((a, b) => (b.score || 0) - (a.score || 0));

            // Notificar a toda la sala el estado detallado en vivo
            io.to(`meet:${meetId}`).emit('meet:answer-status-updated', {
                questionIndex,
                answeredCount: questionAnswers.size,
                totalParticipants: room.participants.size,
                answeredParticipants,
                pendingParticipants,
                allAnswered: pendingParticipants.length === 0 && room.participants.size > 0,
                leaderboard: currentLeaderboard
            });

            io.to(`meet:${meetId}`).emit('meet:answer-count-updated', {
                answeredCount: questionAnswers.size,
                totalParticipants: room.participants.size
            });
        });

        // 8. REVELAR RESULTADOS DE LA PREGUNTA (Líder / Admin hace clic en "Mostrar Resultados")
        socket.on('meet:reveal-question-results', ({ meetId, questionIndex }) => {
            const room = activeRooms.get(String(meetId));
            if (!room) return;
            const isAuthorized = currentUser && (
                String(currentUser.id) === String(room.hostId) ||
                ['admin', 'superadmin', 'lider', 'leader'].includes((currentUser.role || '').toLowerCase())
            );
            if (!isAuthorized) return;

            revealQuestionResults(room, questionIndex, io);
        });

        // 9. SIGUIENTE PREGUNTA O FINALIZAR
        socket.on('meet:next-question', async ({ meetId }) => {
            const room = activeRooms.get(String(meetId));
            if (!room) return;
            const isAuthorized = currentUser && (
                String(currentUser.id) === String(room.hostId) ||
                ['admin', 'superadmin', 'lider', 'leader'].includes((currentUser.role || '').toLowerCase())
            );
            if (!isAuthorized) return;

            const nextIndex = room.currentQuestionIndex + 1;

            if (nextIndex < room.questions.length) {
                room.currentQuestionIndex = nextIndex;
                room.questionStartTime = Date.now();
                room.revealedResults = null;
                room.answers.set(nextIndex, new Map());

                const q = room.questions[nextIndex];
                const leaderboard = Array.from(room.participants.values())
                    .sort((a, b) => (b.score || 0) - (a.score || 0));

                io.to(`meet:${meetId}`).emit('meet:question-started', {
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
                });

                io.to(`meet:${meetId}`).emit('meet:answer-status-updated', {
                    questionIndex: nextIndex,
                    answeredCount: 0,
                    totalParticipants: room.participants.size,
                    answeredParticipants: [],
                    pendingParticipants: Array.from(room.participants.values()).map(p => ({
                        id: p.id,
                        username: p.username,
                        score: p.score || 0
                    })),
                    allAnswered: false,
                    leaderboard
                });

                if (room.revealTimer) clearTimeout(room.revealTimer);
                const timeLimitSec = (q.time_limit_seconds || 25) + 3;
                room.revealTimer = setTimeout(() => {
                    if (room.phase === 'quiz' && room.currentQuestionIndex === nextIndex && !room.revealedResults) {
                        revealQuestionResults(room, nextIndex, io);
                    }
                }, timeLimitSec * 1000);
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

                io.to(`meet:${meetId}`).emit('meet:phase-changed', { phase: 'finished' });
                io.to(`meet:${meetId}`).emit('meet:final-podium', { 
                    podium: finalPodium,
                    totalJoinedCount: totalAttendance,
                    platformOnlineCount: getPlatformOnlineCount()
                });

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
                    await supabase.from('meetings').update({ status: 'ended' }).eq('id', meetId);
                    io.emit('leaderboard-update');
                    io.emit('meet:updated');
                } catch (dbErr) {
                    console.error('[MeetSocket] Error guardando puntos finales:', dbErr);
                }
            }
        });

        // 9.1. FINALIZAR / CERRAR REUNIÓN EN VIVO MANUALMENTE (Líder / Admin)
        socket.on('meet:end-session', async ({ meetId }) => {
            const room = activeRooms.get(String(meetId));
            const isAuthorized = currentUser && (
                (room && String(currentUser.id) === String(room.hostId)) ||
                ['admin', 'superadmin', 'lider', 'leader'].includes((currentUser.role || '').toLowerCase())
            );

            if (isAuthorized) {
                let finalPodium = [];
                let totalAttendance = 0;
                if (room) {
                    room.status = 'ended';
                    room.phase = 'finished';
                    finalPodium = Array.from(room.participants.values())
                        .sort((a, b) => b.score - a.score);
                    totalAttendance = room.allTimeParticipants ? room.allTimeParticipants.size : room.participants.size;
                }

                io.to(`meet:${meetId}`).emit('meet:phase-changed', { phase: 'finished' });
                io.to(`meet:${meetId}`).emit('meet:session-ended', { 
                    meetId: String(meetId),
                    message: 'La reunión ha sido finalizada por el líder.',
                    closed: true,
                    podium: finalPodium,
                    totalJoinedCount: totalAttendance,
                    platformOnlineCount: getPlatformOnlineCount()
                });
                io.emit('meet:session-ended', { 
                    meetId: String(meetId),
                    message: 'La reunión ha sido finalizada por el líder.',
                    closed: true,
                    podium: finalPodium,
                    totalJoinedCount: totalAttendance,
                    platformOnlineCount: getPlatformOnlineCount()
                });
                io.to(`meet:${meetId}`).emit('meet:final-podium', { 
                    podium: finalPodium,
                    totalJoinedCount: totalAttendance,
                    platformOnlineCount: getPlatformOnlineCount()
                });

                try {
                    const supabase = getDb();
                    for (let p of finalPodium) {
                        if (p.score > 0) {
                            const { data: u } = await supabase.from('users').select('points').eq('id', p.id).single();
                            const currentPts = (u && u.points) ? u.points : 0;
                            await supabase.from('users').update({ points: currentPts + p.score }).eq('id', p.id);
                        }
                    }
                    await supabase.from('meetings').update({ status: 'ended' }).eq('id', meetId);
                    activeRooms.delete(String(meetId));
                    io.emit('leaderboard-update');
                    io.emit('meet:updated');
                } catch (dbErr) {
                    console.error('[MeetSocket] Error finalizando reunión:', dbErr);
                }
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
                    const p = room.participants.get(currentUser.id);
                    // Solo eliminar si el socket desconectado coincide con el socket registrado (evita borrar una reconexión entrante)
                    if (p && p.socketId === socket.id) {
                        room.participants.delete(currentUser.id);
                        room.handsRaised.delete(currentUser.id);
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
