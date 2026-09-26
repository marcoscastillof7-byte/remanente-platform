import express from 'express';
import { getDb } from '../db/database.js';

const router = express.Router();

// Caché en memoria para evitar colapsar la DB y la RAM del servidor
const CACHE_TTL = 60000; // 1 minuto
const cache = {
    global: { data: null, lastUpdated: 0 },
    books: {}
};

router.get('/', async (req, res) => {
    try {
        const now = Date.now();
        if (cache.global.data && (now - cache.global.lastUpdated < CACHE_TTL)) {
            return res.json(cache.global.data);
        }

        const supabase = getDb();
        const { data: users, error: uError } = await supabase.from('users').select('id, username');
        const { data: attempts, error: aError } = await supabase.from('quiz_attempts').select('user_id, score');
        const { data: streaks, error: sError } = await supabase.from('study_streaks').select('user_id, current_streak');

        if (uError || aError) throw (uError || aError);

        const leaderboard = users.map(u => {
            const userAttempts = attempts ? attempts.filter(a => a.user_id === u.id) : [];
            const userStreak = streaks ? streaks.find(s => s.user_id === u.id) : null;
            
            const quizzes_completed = userAttempts.length;
            const total_score = userAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
            const avg_score = quizzes_completed > 0 ? total_score / quizzes_completed : 0;
            
            return {
                username: u.username,
                total_score,
                quizzes_completed,
                avg_score,
                current_streak: userStreak ? userStreak.current_streak : 0
            };
        }).filter(u => u.quizzes_completed > 0)
          .sort((a, b) => b.total_score - a.total_score)
          .slice(0, 20);

        cache.global.data = leaderboard;
        cache.global.lastUpdated = now;

        res.json(leaderboard);
    } catch (error) {
        console.error('Error in /leaderboard:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.get('/:bookId', async (req, res) => {
    try {
        const bookId = parseInt(req.params.bookId, 10);
        const now = Date.now();
        
        if (cache.books[bookId] && (now - cache.books[bookId].lastUpdated < CACHE_TTL)) {
            return res.json(cache.books[bookId].data);
        }

        const supabase = getDb();
        const { data: users, error: uError } = await supabase.from('users').select('id, username');
        const { data: attempts, error: aError } = await supabase
            .from('quiz_attempts')
            .select('user_id, score, chapters!inner(book_id)')
            .eq('chapters.book_id', bookId);

        if (uError || aError) throw (uError || aError);

        const leaderboard = users.map(u => {
            const userAttempts = attempts ? attempts.filter(a => a.user_id === u.id) : [];
            
            const quizzes_completed = userAttempts.length;
            const total_score = userAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
            const avg_score = quizzes_completed > 0 ? total_score / quizzes_completed : 0;
            
            return {
                username: u.username,
                total_score,
                quizzes_completed,
                avg_score
            };
        }).filter(u => u.quizzes_completed > 0)
          .sort((a, b) => b.total_score - a.total_score)
          .slice(0, 20);

        cache.books[bookId] = {
            data: leaderboard,
            lastUpdated: now
        };

        res.json(leaderboard);
    } catch (error) {
        console.error('Error in /leaderboard/:bookId:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
