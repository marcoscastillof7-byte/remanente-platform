import { io } from 'socket.io-client';
import { getDb } from '../server/db/database.js';

const SERVER_URL = 'http://localhost:3001';

// Definición de los 5 Bots con personalidades, precisión y tiempos de respuesta distintos
const BOTS_CONFIG = [
    { id: 9101, username: 'Bot_Samuel', accuracy: 0.95, minDelayMs: 1500, maxDelayMs: 3000, reaction: '🔥' },
    { id: 9102, username: 'Bot_David',  accuracy: 0.80, minDelayMs: 2500, maxDelayMs: 4500, reaction: '🙏' },
    { id: 9103, username: 'Bot_Ester',  accuracy: 0.65, minDelayMs: 3500, maxDelayMs: 5500, reaction: '📖' },
    { id: 9104, username: 'Bot_Josue',  accuracy: 0.50, minDelayMs: 4000, maxDelayMs: 7000, reaction: '❤️' },
    { id: 9105, username: 'Bot_Debora', accuracy: 0.75, minDelayMs: 1200, maxDelayMs: 2800, reaction: '💡' }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function setupTestMeeting() {
    console.log('\n[1/6] Configurando reunión de prueba en Supabase...');
    const supabase = getDb();

    // 1. Obtener 5 preguntas bíblicas reales de la base de datos
    const { data: dbQuestions, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .limit(5);

    if (qErr || !dbQuestions || dbQuestions.length === 0) {
        throw new Error('No se pudieron cargar preguntas de la base de datos: ' + (qErr?.message || 'vació'));
    }

    console.log(`[OK] Cargadas ${dbQuestions.length} preguntas bíblicas reales para la prueba.`);

    const questionsFormatted = dbQuestions.map((q, idx) => ({
        id: q.id || `q_${idx}`,
        question_text: q.question_text,
        questionText: q.question_text,
        option_a: q.option_a,
        optionA: q.option_a,
        option_b: q.option_b,
        optionB: q.option_b,
        option_c: q.option_c,
        optionC: q.option_c,
        option_d: q.option_d,
        optionD: q.option_d,
        correct_answer: (q.correct_answer || 'a').toLowerCase(),
        correctAnswer: (q.correct_answer || 'a').toLowerCase(),
        explanation: q.explanation || 'Explicación fundamentada en las Sagradas Escrituras.',
        verse_reference: q.verse_reference || '',
        time_limit_seconds: 25
    }));

    // 2. Crear reunión en estado 'live' con el admin Alexas (ID 1)
    const roomName = `test_bot_meet_${Date.now()}`;
    const metaPayload = JSON.stringify({
        text: 'Reunión de prueba automatizada con 5 bots en vivo',
        book_name: '1 Samuel',
        chapters_selected: [1],
        questions: questionsFormatted,
        phase: 'reading'
    });

    const { data: meet, error: mErr } = await supabase
        .from('meetings')
        .insert([{
            title: 'Meet de Prueba - 5 Bots Bíblicos',
            description: metaPayload,
            scheduled_for: new Date().toISOString(),
            host_id: 1, // alexas
            status: 'live',
            room_name: roomName
        }])
        .select('*, users:host_id(username)')
        .single();

    if (mErr) {
        throw new Error('Error creando reunión de prueba: ' + mErr.message);
    }

    console.log(`[OK] Reunión creada exitosamente. ID: ${meet.id} | Sala: ${meet.room_name}`);
    return { meet, questions: questionsFormatted };
}

async function runBotsSimulation() {
    const detectedErrors = [];
    let hostSocket = null;
    const botSockets = [];

    try {
        const { meet, questions } = await setupTestMeeting();
        const meetId = String(meet.id);

        console.log('\n[2/6] Conectando Host (Líder) a la sala...');
        hostSocket = io(SERVER_URL, { transports: ['websocket'] });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout conectando Host')), 5000);
            hostSocket.on('connect', () => {
                clearTimeout(timeout);
                console.log(`[Host Conectado] Socket ID: ${hostSocket.id}`);
                hostSocket.emit('meet:join', {
                    meetId,
                    user: { id: 1, username: 'alexas', role: 'admin' }
                });
            });
            hostSocket.on('meet:initial-state', (state) => {
                console.log(`[Host En Sala] Fase inicial: ${state.phase} | Preguntas: ${state.questionsCount}`);
                resolve(state);
            });
            hostSocket.on('meet:error', (err) => {
                detectedErrors.push(`Host error: ${JSON.stringify(err)}`);
            });
        });

        console.log('\n[3/6] Desplegando 5 Bots en Remanente Meet...');
        
        for (const config of BOTS_CONFIG) {
            const socket = io(SERVER_URL, { transports: ['websocket'] });
            botSockets.push({ socket, config, answers: {}, finished: false });

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error(`Timeout conectando ${config.username}`)), 5000);
                socket.on('connect', () => {
                    clearTimeout(timeout);
                    socket.emit('platform:identify', {
                        id: config.id,
                        username: config.username,
                        role: 'user',
                        points: 500
                    });

                    socket.emit('meet:join', {
                        meetId,
                        user: { id: config.id, username: config.username, role: 'user' }
                    });
                });

                socket.on('meet:initial-state', (state) => {
                    console.log(`  🤖 ${config.username} se unió exitosamente a la sala (Total en sala: ${state.connectedCount})`);
                    resolve(state);
                });

                socket.on('meet:error', (err) => {
                    detectedErrors.push(`${config.username} error: ${JSON.stringify(err)}`);
                });
            });

            await sleep(200);
        }

        // Bots envían reacciones en vivo de prueba
        console.log('\n[4/6] Probando reacciones en vivo de los bots...');
        for (const b of botSockets) {
            b.socket.emit('meet:send-reaction', {
                meetId,
                reaction: b.config.reaction
            });
        }
        await sleep(500);

        // Host inicia el Quiz
        console.log('\n[5/6] Host inicia el Quiz en vivo (meet:start-quiz)...');
        hostSocket.emit('meet:start-quiz', {
            meetId,
            questions
        });

        // Coordinar respuesta concurrente de cada Bot a cada pregunta
        console.log('Esperando evento meet:quiz-started en todos los bots...');
        
        const botsPromises = botSockets.map(async (botObj) => {
            const { socket, config } = botObj;

            return new Promise((resolve) => {
                socket.on('meet:quiz-started', async (quizData) => {
                    console.log(`  🎯 ${config.username} recibió quiz con ${quizData.totalQuestions} preguntas. Iniciando respuestas...`);
                    
                    const qList = quizData.questions || questions;

                    for (let qIdx = 0; qIdx < qList.length; qIdx++) {
                        const q = qList[qIdx];
                        const correctLetter = (q.correct_answer || q.correctAnswer || 'a').toLowerCase();
                        
                        // Decidir si responde correcto o distractor según su nivel de precisión
                        const willBeCorrect = Math.random() <= config.accuracy;
                        let chosenAnswer = correctLetter;

                        if (!willBeCorrect) {
                            const distractors = ['a', 'b', 'c', 'd'].filter(x => x !== correctLetter);
                            chosenAnswer = distractors[Math.floor(Math.random() * distractors.length)];
                        }

                        // Simular tiempo de lectura y reflexión humana
                        const delay = Math.floor(Math.random() * (config.maxDelayMs - config.minDelayMs) + config.minDelayMs);
                        await sleep(delay);

                        // Enviar respuesta
                        socket.emit('meet:submit-answer', {
                            meetId,
                            questionIndex: qIdx,
                            selectedAnswer: chosenAnswer,
                            timeTakenMs: delay,
                            user: { id: config.id, username: config.username, role: 'user' }
                        });

                        // Esperar confirmación
                        await new Promise((ansResolve) => {
                            const handler = (ansResult) => {
                                if (ansResult.questionIndex === qIdx) {
                                    socket.off('meet:answer-received', handler);
                                    botObj.answers[qIdx] = ansResult;
                                    console.log(`    ✓ ${config.username} resp #${qIdx + 1} (${chosenAnswer.toUpperCase()} - ${ansResult.isCorrect ? 'Correcto +' + ansResult.points + 'pts' : 'Incorrecto'}) [${delay}ms]`);
                                    ansResolve();
                                }
                            };
                            socket.on('meet:answer-received', handler);
                        });
                    }

                    botObj.finished = true;
                    console.log(`  🏁 ${config.username} finalizó todas las preguntas!`);
                    resolve();
                });
            });
        });

        await Promise.all(botsPromises);
        console.log('\n[OK] Todos los bots completaron el quiz exitosamente.');

        // Esperar brevemente a que el servidor consolide el leaderboard y persistencia
        await sleep(1000);

        console.log('\n[6/6] Host revela los resultados finales (meet:reveal-quiz-results)...');
        
        const resultsPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout esperando resultados finales')), 8000);
            
            hostSocket.on('meet:quiz-results-revealed', (resultsPayload) => {
                clearTimeout(timeout);
                resolve(resultsPayload);
            });
        });

        hostSocket.emit('meet:reveal-quiz-results', { meetId });
        const revealed = await resultsPromise;

        console.log('\n======================================================');
        console.log('       RESULTADOS OFICIALES DE LA SIMULACIÓN');
        console.log('======================================================');
        
        console.log(`\n🏆 PODIO DE HONOR:`);
        const podium = revealed.podium || [];
        podium.forEach((p, idx) => {
            const medal = idx === 0 ? '🥇 1º' : idx === 1 ? '🥈 2º' : '🥉 3º';
            console.log(`   ${medal} ${p.username.padEnd(14)} | ${p.score} pts | ${p.correctCount}/${p.totalQuestions || 5} aciertos`);
        });

        console.log(`\n📊 TABLA GENERAL DE CLASIFICACIÓN (${(revealed.leaderboard || []).length} participantes):`);
        (revealed.leaderboard || []).forEach((p, idx) => {
            console.log(`   #${idx + 1} ${p.username.padEnd(14)} | Score: ${String(p.score).padStart(4)} pts | Aciertos: ${p.correctCount}/5 | Tiempo Prom: ${p.avgTimeSec}s`);
        });

        console.log(`\n📈 ESTADÍSTICAS POR PREGUNTA:`);
        const qResults = revealed.questionsResults || [];
        qResults.forEach((qr, idx) => {
            console.log(`   Pregunta #${idx + 1}: ${qr.correctPercentage}% de acierto | Correcta: ${qr.correctAnswer.toUpperCase()} | Votos: A:${qr.breakdown.a} B:${qr.breakdown.b} C:${qr.breakdown.c} D:${qr.breakdown.d}`);
        });

        // Verificaciones y comprobaciones de integridad
        console.log('\n======================================================');
        console.log('             INSPECCIÓN DE ERRORES');
        console.log('======================================================');

        if (detectedErrors.length === 0) {
            console.log('✅ CERO ERRORES DE SOCKET O RED DETECTADOS.');
        } else {
            console.error('❌ ERRORES DETECTADOS:', detectedErrors);
        }

        // Validar orden del leaderboard
        let orderValid = true;
        for (let i = 0; i < (revealed.leaderboard || []).length - 1; i++) {
            const curr = revealed.leaderboard[i];
            const next = revealed.leaderboard[i + 1];
            if (curr.score < next.score) {
                orderValid = false;
                detectedErrors.push(`Inconsistencia en orden de leaderboard: ${curr.username} (${curr.score}) antes de ${next.username} (${next.score})`);
            }
        }
        if (orderValid) {
            console.log('✅ Ordenamiento de posiciones estricto y correcto por puntaje y desempates.');
        }

        // Limpiar la reunión de prueba para no dejar basura en la base de datos
        console.log('\n[Limpieza] Limpiando reunión de prueba en Supabase...');
        const supabase = getDb();
        await supabase.from('meetings').delete().eq('id', meetId);
        console.log('✅ Reunión de prueba eliminada de la base de datos.');

    } catch (err) {
        console.error('\n❌ ERROR FATAL EN LA SIMULACIÓN:', err);
        detectedErrors.push(err.message);
    } finally {
        if (hostSocket) hostSocket.disconnect();
        botSockets.forEach(b => b.socket.disconnect());
        console.log('\nTodos los sockets desconectados.');
        
        if (detectedErrors.length > 0) {
            console.log(`\nSe encontraron ${detectedErrors.length} errores para reparar.`);
            process.exit(1);
        } else {
            console.log('\n🚀 ¡SIMULACIÓN COMPLETADA CON ÉXITO ROTUNDO! 0 ERRORES.');
            process.exit(0);
        }
    }
}

runBotsSimulation();
