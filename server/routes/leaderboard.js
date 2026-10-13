import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';
import { getLocalDate, getDaysDiff } from '../utils/streaks.js';

const router = express.Router();
router.use(auth);

let globalCache = null;
let globalCacheTime = 0;

router.get('/', async (req, res) => {
    try {
        const groupId = req.user.group_id;
        const internal = req.query.internal === 'true';

        // Si es consulta general global y tenemos caché fresco (< 15 seg), responder de inmediato
        if (!internal && globalCache && (Date.now() - globalCacheTime < 15000)) {
            return res.json(globalCache);
        }

        const supabase = getDb();
        let query = supabase.from('users').select('id, username, points, group_id, groups(name)');
        
        if (internal && groupId) {
            query = query.eq('group_id', groupId);
        }

        const clientDate = req.query.clientDate || req.headers['x-client-date'] || null;
        const today = clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate) ? clientDate : getLocalDate(new Date());

        const { data: users, error: uError } = await query;
        const { data: attempts, error: aError } = await supabase.from('quiz_attempts').select('user_id, score');
        const { data: streaks, error: sError } = await supabase.from('study_streaks').select('user_id, current_streak, last_study_date');

        if (uError || aError) throw (uError || aError);

        const leaderboard = users.map(u => {
            const userAttempts = attempts ? attempts.filter(a => a.user_id === u.id) : [];
            const userStreak = streaks ? streaks.find(s => s.user_id === u.id) : null;
            
            const quizzes_completed = userAttempts.length;
            const total_score = userAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
            const avg_score = quizzes_completed > 0 ? total_score / quizzes_completed : 0;
            const points = u.points || 0;

            let activeStreak = 0;
            if (userStreak && userStreak.last_study_date) {
                const lastDay = getLocalDate(userStreak.last_study_date);
                const diff = getDaysDiff(lastDay, today);
                if (diff === 0 || diff === 1) {
                    activeStreak = userStreak.current_streak || 0;
                }
            }
            
            return {
                username: u.username,
                groupName: u.groups?.name || null,
                points,
                total_score,
                quizzes_completed,
                avg_score,
                current_streak: activeStreak
            };
        }).filter(u => u.points > 0 || u.quizzes_completed > 0)
          .sort((a, b) => b.points - a.points)
          .slice(0, 50); // Muestra top 50 en la global

        if (!internal) {
            globalCache = leaderboard;
            globalCacheTime = Date.now();
        }

        res.json(leaderboard);
    } catch (error) {
        console.error('Error in /leaderboard:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.get('/:bookId', async (req, res) => {
    try {
        const groupId = req.user.group_id;
        const bookId = parseInt(req.params.bookId, 10);
        const internal = req.query.internal === 'true';

        const supabase = getDb();
        let query = supabase.from('users').select('id, username, group_id, groups(name)');
        
        if (internal && groupId) {
            query = query.eq('group_id', groupId);
        }

        const { data: users, error: uError } = await query;
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
                groupName: u.groups?.name || null,
                total_score,
                quizzes_completed,
                avg_score
            };
        }).filter(u => u.quizzes_completed > 0)
          .sort((a, b) => b.total_score - a.total_score)
          .slice(0, 50);

        res.json(leaderboard);
    } catch (error) {
        console.error('Error in /leaderboard/:bookId:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
