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
