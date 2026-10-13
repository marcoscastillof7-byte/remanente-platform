import { getDb } from '../db/database.js';

// Almacén en memoria de salas activas para latencia 0ms
const activeRooms = new Map();

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
        answers: new Map(), // questionIndex -> Map(userId -> { selectedAnswer, isCorrect, points, timeTakenMs })
        handsRaised: new Set(),
        currentReader: null
    };

    activeRooms.set(meetId, roomState);
    return roomState;
}

export function setupMeetSocket(io) {
    io.on('connection', (socket) => {
        let currentMeetId = null;
        let currentUser = null;

        // 1. UNIRSE A LA SALA MEET
        socket.on('meet:join', async ({ meetId, user }) => {
            if (!meetId || !user) return;
            currentMeetId = String(meetId);
            currentUser = user;

            socket.join(`meet:${currentMeetId}`);
            const room = await getOrCreateRoom(currentMeetId);
            if (!room) {
                socket.emit('meet:error', { message: 'Sala no encontrada' });
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
                questions: sanitizedQuestions
            });

            // Avisar a los demás
            io.to(`meet:${currentMeetId}`).emit('meet:participants-updated', {
                participants: Array.from(room.participants.values()),
                totalCount: room.participants.size
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
            if (currentUser && (String(currentUser.id) === String(room.hostId) || currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
                room.phase = 'quiz';
                room.currentQuestionIndex = 0;
                room.questionStartTime = Date.now();
                room.answers.set(0, new Map());

                const q = room.questions[0];
                if (!q) return;

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
                    }
                });
            }
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

            // Si ya respondió esta pregunta, ignorar
            if (questionAnswers.has(currentUser.id)) return;

            const q = room.questions[questionIndex];
            const isCorrect = q && q.correct_answer === selectedAnswer;

            // Puntuación estilo Kahoot: Base 50 + velocidad hasta 50 puntos adicionales
            let points = 0;
            if (isCorrect) {
                const limitMs = (q.time_limit_seconds || 25) * 1000;
                const timeLeftRatio = Math.max(0, Math.min(1, 1 - (timeTakenMs / limitMs)));
                const speedBonus = Math.round(timeLeftRatio * 50);
                points = 50 + speedBonus;
            }

            questionAnswers.set(currentUser.id, {
                selectedAnswer,
                isCorrect,
                points,
                timeTakenMs
            });

            // Actualizar score acumulado del participante
            const participant = room.participants.get(currentUser.id);
            if (participant) {
                participant.score = (participant.score || 0) + points;
            }

            socket.emit('meet:answer-received', { isCorrect, points });

            // Notificar a todos cuántos han respondido
            io.to(`meet:${meetId}`).emit('meet:answer-count-updated', {
                answeredCount: questionAnswers.size,
                totalParticipants: room.participants.size
            });
        });

        // 8. REVELAR RESULTADOS DE LA PREGUNTA (Fin de tiempo o Líder avanza)
        socket.on('meet:reveal-question-results', ({ meetId, questionIndex }) => {
            const room = activeRooms.get(String(meetId));
            if (!room) return;
            if (currentUser && (String(currentUser.id) === String(room.hostId) || currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
                const q = room.questions[questionIndex];
                if (!q) return;

                const qAnswers = room.answers.get(questionIndex) || new Map();
                const breakdown = { a: 0, b: 0, c: 0, d: 0 };
                qAnswers.forEach((ans) => {
                    if (ans.selectedAnswer && breakdown[ans.selectedAnswer] !== undefined) {
                        breakdown[ans.selectedAnswer]++;
                    }
                });

                // Top 5 del Meet
                const leaderboard = Array.from(room.participants.values())
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 5);

                io.to(`meet:${meetId}`).emit('meet:question-results', {
                    questionIndex,
                    correctAnswer: q.correct_answer,
                    explanation: q.explanation,
                    verseReference: q.verse_reference,
                    breakdown,
                    leaderboard
                });
            }
        });

        // 9. SIGUIENTE PREGUNTA O FINALIZAR
        socket.on('meet:next-question', async ({ meetId }) => {
            const room = activeRooms.get(String(meetId));
            if (!room) return;
            if (currentUser && (String(currentUser.id) === String(room.hostId) || currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
                const nextIndex = room.currentQuestionIndex + 1;

                if (nextIndex < room.questions.length) {
                    room.currentQuestionIndex = nextIndex;
                    room.questionStartTime = Date.now();
                    room.answers.set(nextIndex, new Map());

                    const q = room.questions[nextIndex];
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
                        }
                    });
                } else {
                    // QUIZ TERMINADO -> PODIO FINAL
                    room.phase = 'finished';
                    const finalPodium = Array.from(room.participants.values())
                        .sort((a, b) => b.score - a.score);

                    io.to(`meet:${meetId}`).emit('meet:phase-changed', { phase: 'finished' });
                    io.to(`meet:${meetId}`).emit('meet:final-podium', { podium: finalPodium });

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
                    } catch (dbErr) {
                        console.error('[MeetSocket] Error guardando puntos finales:', dbErr);
                    }
                }
            }
        });

        // 10. REACCIONES BÍBLICAS EN VIVO (Amén, Fuego, Gloria)
        socket.on('meet:send-reaction', ({ meetId, reaction }) => {
            if (!meetId || !reaction || !currentUser) return;
            io.to(`meet:${meetId}`).emit('meet:reaction-received', {
                userId: currentUser.id,
                username: currentUser.username,
                reaction,
                id: `${Date.now()}_${Math.random()}`
            });
        });

        // 11. DESCONEXIÓN CON PROTECCIÓN PARA RECONEXIONES MÓVILES
        socket.on('disconnect', () => {
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
                            totalCount: room.participants.size
                        });
                    }
                }
            }
        });
    });
}
