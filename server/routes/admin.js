import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';

const router = express.Router();
router.use(auth);
router.use(adminOnly);

router.get('/users', async (req, res) => {
    try {
        const supabase = getDb();
        const { data: users, error: uError } = await supabase.from('users').select('id, username, email, role, created_at');
        const { data: attempts, error: aError } = await supabase.from('quiz_attempts').select('user_id, score');
        const { data: streaks, error: sError } = await supabase.from('study_streaks').select('user_id, current_streak');

        if (uError) throw uError;

        const result = users.map(u => {
            const userAttempts = attempts ? attempts.filter(a => a.user_id === u.id) : [];
            const userStreak = streaks ? streaks.find(s => s.user_id === u.id) : null;
            
            const total_quizzes = userAttempts.length;
            const totalScore = userAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
            const avg_score = total_quizzes > 0 ? totalScore / total_quizzes : 0;

            return {
                ...u,
                total_quizzes,
                avg_score,
                current_streak: userStreak ? userStreak.current_streak : 0
            };
        }).sort((a, b) => b.avg_score - a.avg_score);

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.get('/users/:userId/performance', async (req, res) => {
    try {
        const supabase = getDb();
        const userId = parseInt(req.params.userId, 10);

        const { data: user, error: uError } = await supabase.from('users').select('username').eq('id', userId).single();
        if (uError) throw uError;

        const { data: attempts } = await supabase.from('quiz_attempts').select('score, chapter_id, completed_at').eq('user_id', userId);
        const { data: streak } = await supabase.from('study_streaks').select('current_streak').eq('user_id', userId).single();
        const { data: books } = await supabase.from('books').select('*').order('order_index');
        const { data: chapters } = await supabase.from('chapters').select('id, chapter_number, title, book_id');

        const total_quizzes = attempts ? attempts.length : 0;
        const totalScore = attempts ? attempts.reduce((sum, a) => sum + (a.score || 0), 0) : 0;
        const avg_score = total_quizzes > 0 ? totalScore / total_quizzes : 0;

        const result = {
            username: user.username,
            total_quizzes,
            avg_score,
            current_streak: streak ? streak.current_streak : 0,
            books: books.map(book => {
                const bookChapters = chapters.filter(c => c.book_id === book.id).sort((a, b) => a.chapter_number - b.chapter_number);
                return {
                    ...book,
                    chapters: bookChapters.map(c => {
                        const cAttempts = attempts ? attempts.filter(a => a.chapter_id === c.id) : [];
                        const cTotalScore = cAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
                        const cBestScore = cAttempts.length > 0 ? Math.max(...cAttempts.map(a => a.score)) : 0;
                        const cLastAttempt = cAttempts.length > 0 ? cAttempts.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))[0].completed_at : null;

                        return {
                            chapter_id: c.id,
                            chapter_number: c.chapter_number,
                            title: c.title,
                            attempts: cAttempts.length,
                            best_score: cBestScore,
                            avg_score: cAttempts.length > 0 ? cTotalScore / cAttempts.length : 0,
                            last_attempt: cLastAttempt
                        };
                    })
                };
            })
        };

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const supabase = getDb();
        const { count: total_users } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { data: attempts } = await supabase.from('quiz_attempts').select('score, user_id, completed_at');

        let total_quizzes = 0;
        let avg_score = 0;
        let active_users = 0;

        if (attempts && attempts.length > 0) {
            total_quizzes = attempts.length;
            const totalScore = attempts.reduce((sum, a) => sum + (a.score || 0), 0);
            avg_score = totalScore / total_quizzes;

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const activeUserIds = new Set(
                attempts
                    .filter(a => new Date(a.completed_at) >= sevenDaysAgo)
                    .map(a => a.user_id)
            );
            active_users = activeUserIds.size;
        }

        res.json({ total_users: total_users || 0, total_quizzes, avg_score, active_users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.get('/chapter-stats/:chapterId', async (req, res) => {
    try {
        const supabase = getDb();
        const { data: attempts, error: aError } = await supabase
            .from('quiz_attempts')
            .select('score, user_id, users(username)')
            .eq('chapter_id', req.params.chapterId);

        if (aError) throw aError;

        const userStats = {};
        for (let a of (attempts || [])) {
            if (!userStats[a.user_id]) {
                userStats[a.user_id] = { username: a.users?.username, attempts: 0, best_score: 0 };
            }
            userStats[a.user_id].attempts++;
            if (a.score > userStats[a.user_id].best_score) {
                userStats[a.user_id].best_score = a.score;
            }
        }

        res.json(Object.values(userStats));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.post('/questions', async (req, res) => {
    try {
        const supabase = getDb();
        const { chapter_id, question_text, option_a, option_b, option_c, option_d, correct_answer, difficulty, explanation, verse_reference } = req.body;
        
        const { data, error } = await supabase.from('questions').insert([{
            chapter_id, question_text, option_a, option_b, option_c, option_d, correct_answer, difficulty, explanation, verse_reference
        }]).select().single();

        if (error) throw error;
        res.json({ id: data.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.post('/questions/:chapterId/bulk', async (req, res) => {
    try {
        const supabase = getDb();
        const { chapterId } = req.params;
        const { questions, mode } = req.body;

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Lista de preguntas vacía o inválida' });
        }

        if (mode === 'replace') {
            const { error: delError } = await supabase.from('questions').delete().eq('chapter_id', chapterId);
            if (delError) throw delError;
        }

        const questionsToInsert = questions.map(q => ({
            chapter_id: chapterId,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_answer: q.correct_answer,
            difficulty: q.difficulty || 'medio',
            explanation: q.explanation || '',
            verse_reference: q.verse_reference || ''
        }));

        const { error: insError } = await supabase.from('questions').insert(questionsToInsert);
        if (insError) throw insError;

        // --- NOTIFICATIONS ---
        try {
            const { data: allUsers } = await supabase.from('users').select('id');
            const { data: c } = await supabase.from('chapters').select('id, title, chapter_number, books(name)').eq('id', chapterId).single();
            if (allUsers && allUsers.length > 0 && c) {
                const bookName = c.books?.name || 'Libro';
                const notifsToInsert = allUsers.map(u => ({
                    user_id: u.id,
                    title: `Nuevas preguntas en ${bookName}`,
                    message: `El administrador ha actualizado las preguntas del Capítulo ${c.chapter_number}.`,
                    link: `/quiz/${c.id}`
                }));
                await supabase.from('notifications').insert(notifsToInsert);
            }
        } catch (notifErr) {
            console.error("Error creating bulk notifications:", notifErr);
        }

        res.json({ message: 'Importación masiva exitosa', count: questionsToInsert.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno en importación masiva' });
    }
});

router.post('/global-bulk', async (req, res) => {
    try {
        const supabase = getDb();
        const { questions, mode } = req.body;

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Lista de preguntas vacía o inválida' });
        }

        if (mode === 'replace') {
            // Eliminar solo de los capítulos que están en esta lista de importación
            const chapterIds = [...new Set(questions.map(q => q.chapter_id))];
            if (chapterIds.length > 0) {
                const { error: delError } = await supabase.from('questions').delete().in('chapter_id', chapterIds);
                if (delError) throw delError;
            }
        }

        const { error: insError } = await supabase.from('questions').insert(questions);
        if (insError) throw insError;

        // --- NOTIFICATIONS ---
        // Generar notificación para todos los usuarios sobre los capítulos actualizados
        try {
            const { data: allUsers } = await supabase.from('users').select('id');
            if (allUsers && allUsers.length > 0) {
                const chapterIds = [...new Set(questions.map(q => q.chapter_id))];
                const { data: chaps } = await supabase.from('chapters').select('id, title, chapter_number, books(name)').in('id', chapterIds);
                
                if (chaps && chaps.length > 0) {
                    const notifsToInsert = [];
                    const timeNow = new Date().toISOString();
                    
                    for (let c of chaps) {
                        const bookName = c.books?.name || 'Libro';
                        const notifTitle = `Nuevas preguntas en ${bookName}`;
                        const notifMsg = `El administrador ha actualizado las preguntas del Capítulo ${c.chapter_number}. ¡Ve a repasarlas!`;
                        const link = `/quiz/${c.id}`;
                        
                        for (let u of allUsers) {
                            notifsToInsert.push({
                                user_id: u.id,
                                title: notifTitle,
                                message: notifMsg,
                                link,
                                created_at: timeNow
                            });
                        }
                    }
                    
                    if (notifsToInsert.length > 0) {
                        // Insertar en chunks si son muchas
                        await supabase.from('notifications').insert(notifsToInsert);
                    }
                }
            }
        } catch (notifErr) {
            console.error("Error creating global-bulk notifications:", notifErr);
        }

        res.json({ message: 'Importación global masiva exitosa', count: questions.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno en importación global masiva' });
    }
});

router.put('/questions/:id', async (req, res) => {
    try {
        const supabase = getDb();
        const { question_text, option_a, option_b, option_c, option_d, correct_answer, difficulty, explanation, verse_reference } = req.body;
        
        const { error } = await supabase.from('questions').update({
            question_text, option_a, option_b, option_c, option_d, correct_answer, difficulty, explanation, verse_reference
        }).eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Pregunta actualizada' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.delete('/questions/:id', async (req, res) => {
    try {
        const supabase = getDb();
        const { error } = await supabase.from('questions').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ message: 'Pregunta eliminada' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.get('/questions/:chapterId', async (req, res) => {
    try {
        const supabase = getDb();
        const { data, error } = await supabase.from('questions').select('*').eq('chapter_id', req.params.chapterId);
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
