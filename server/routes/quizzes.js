import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';
import { recordStudySession } from '../utils/streaks.js';

const router = express.Router();

router.use(auth);

router.get('/:chapterId', async (req, res) => {
    try {
        const supabase = getDb();
        const { data: questions, error } = await supabase
            .from('questions')
            .select('id, chapter_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, verse_reference, difficulty')
            .eq('chapter_id', req.params.chapterId);
            
        if (error) throw error;

        // Shuffle en JavaScript (para emular ORDER BY RANDOM LIMIT 15)
        const shuffled = questions.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 15);
        
        res.json(selected);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.post('/:chapterId/submit', async (req, res) => {
    const { answers } = req.body;
    const chapterId = req.params.chapterId;
    const userId = req.user.id;
    const supabase = getDb();

    if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({ error: 'Respuestas inválidas' });
    }

    try {
        let correctCount = 0;
        const results = [];

        // Fetch correct answers for verification
        const questionIds = answers.map(a => a.questionId);
        const { data: dbQuestions, error: qError } = await supabase
            .from('questions')
            .select('id, correct_answer, explanation, verse_reference')
            .in('id', questionIds);

        if (qError) throw qError;

        const qMap = {};
        for (let q of dbQuestions) {
            qMap[q.id] = q;
        }

        // Evaluamos respuestas
        for (let ans of answers) {
            const q = qMap[ans.questionId];
            if (q) {
                const isCorrect = q.correct_answer === ans.selectedAnswer;
                if (isCorrect) correctCount++;
                results.push({
                    questionId: ans.questionId,
                    selectedAnswer: ans.selectedAnswer,
                    correctAnswer: q.correct_answer,
                    isCorrect,
                    explanation: q.explanation,
                    verseReference: q.verse_reference,
                    timeSpent: ans.timeSpent || 0
                });
            }
        }

        const score = Math.round((correctCount / answers.length) * 100);

        // --- POINTS LOGIC (ANTI-SPAM & INTENTOS) ---
        let totalPointsEarned = 0;
        let quizPointsEarned = 0;
        let streakPointsEarned = 0;
        let achievementPointsEarned = 0;

        // Check past attempts for this chapter
        const { data: pastAttempts } = await supabase
            .from('quiz_attempts')
            .select('score')
            .eq('user_id', userId)
            .eq('chapter_id', chapterId);

        const attemptCount = (pastAttempts && pastAttempts.length) ? pastAttempts.length : 0;
        const isSecondAttempt = attemptCount === 1;

        if (attemptCount === 0) {
            // Primer intento: 5 puntos base por cada respuesta correcta
            const pointsPerCorrect = 5;
            quizPointsEarned = 10 + (correctCount * pointsPerCorrect) + (score === 100 ? 15 : 0);
        } else if (attemptCount === 1) {
            // Segundo intento: se disminuye un 15% de los puntos base de cada respuesta contestada (5 * 0.85 = 4.25 pts)
            const pointsPerCorrect = 5 * 0.85; // 4.25
            quizPointsEarned = Math.round(10 + (correctCount * pointsPerCorrect) + (score === 100 ? 15 : 0));
        } else {
            // Tercer intento en adelante: 0 puntos de quiz
            quizPointsEarned = 0;
        }

        totalPointsEarned += quizPointsEarned;

        // Insert attempt
        const { data: attemptData, error: attemptError } = await supabase
            .from('quiz_attempts')
            .insert([{
                user_id: userId,
                chapter_id: chapterId,
                score,
                total_questions: answers.length
            }])
            .select()
            .single();
            
        if (attemptError) throw attemptError;
        const attemptId = attemptData.id;

        // Insert answers
        const answersToInsert = results.map(res => ({
            attempt_id: attemptId,
            question_id: res.questionId,
            selected_answer: res.selectedAnswer,
            is_correct: res.isCorrect ? 1 : 0,
            time_spent_seconds: res.timeSpent
        }));

        if (answersToInsert.length > 0) {
            const { error: answersError } = await supabase.from('quiz_answers').insert(answersToInsert);
            if (answersError) console.error("Error guardando respuestas:", answersError);
        }

        // --- STREAK & STREAK POINTS ---
        const clientDate = req.body.clientDate || req.headers['x-client-date'] || null;
        const streakResult = await recordStudySession(supabase, userId, clientDate);
        const newStreak = streakResult.current_streak;
        const longestStreak = streakResult.longest_streak;
        streakPointsEarned = streakResult.streakPointsEarned;
        totalPointsEarned += streakPointsEarned;

        // --- EVALUAR LOGROS & ACHIEVEMENT POINTS ---
        try {
            const { data: allAttempts } = await supabase.from('quiz_attempts').select('score').eq('user_id', userId);
            const totalQuizzes = allAttempts ? allAttempts.length : 0;
            
            const { data: userAch } = await supabase.from('user_achievements').select('achievement_id').eq('user_id', userId);
            const unlockedSet = new Set((userAch || []).map(a => a.achievement_id));
            
            // Assume we added points_reward to achievements in db, fallback to 100
            const { data: achievements } = await supabase.from('achievements').select('*');
            
            const newlyUnlocked = [];
            if (achievements) {
                for (let a of achievements) {
                    if (unlockedSet.has(a.id)) continue;
                    
                    let criteriaMet = false;
                    if (a.criteria_type === 'total_quizzes' && totalQuizzes >= a.criteria_value) {
                        criteriaMet = true;
                    } else if (a.criteria_type === 'perfect_score' && score === 100) {
                        criteriaMet = true;
                    } else if (a.criteria_type === 'streak' && newStreak >= a.criteria_value) {
                        criteriaMet = true;
                    } else if (a.criteria_type === 'book_completed') {
                        const { data: userChaps } = await supabase
                            .from('quiz_attempts')
                            .select('chapter_id, chapters!inner(book_id)')
                            .eq('user_id', userId);
                        if (userChaps) {
                            const { data: allBooks } = await supabase.from('books').select('id, chapters_count');
                            let booksCompleted = 0;
                            for (let b of (allBooks || [])) {
                                const chapsInBook = new Set(userChaps.filter(c => c.chapters?.book_id === b.id).map(c => c.chapter_id));
                                if (chapsInBook.size >= b.chapters_count && b.chapters_count > 0) {
                                    booksCompleted++;
                                }
                            }
                            if (booksCompleted >= a.criteria_value) {
                                criteriaMet = true;
                            }
                        }
                    }
                    
                    if (criteriaMet) {
                        newlyUnlocked.push({ user_id: userId, achievement_id: a.id });
                        achievementPointsEarned += (a.points_reward || 100);
                    }
                }
            }
            
            totalPointsEarned += achievementPointsEarned;
            
            if (newlyUnlocked.length > 0) {
                await supabase.from('user_achievements').insert(newlyUnlocked);
            }
        } catch (achError) {
            console.error("Error evaluando logros:", achError);
        }
        
        // --- ADD TOTAL POINTS TO USER ---
        if (totalPointsEarned > 0) {
            // First get current points
            const { data: u } = await supabase.from('users').select('points').eq('id', userId).single();
            const currentPoints = (u && u.points) ? u.points : 0;
            
            await supabase.from('users').update({ points: currentPoints + totalPointsEarned }).eq('id', userId);
        }

        if (req.app.get('io')) {
            req.app.get('io').emit('leaderboard-update');
        }

        res.json({ 
            score, 
            correctCount, 
            totalQuestions: answers.length, 
            results,
            pointsEarned: totalPointsEarned,
            quizPointsEarned,
            streakPointsEarned,
            achievementPointsEarned,
            newStreak,
            longestStreak,
            isNewDay: streakResult.isNewDay,
            studiedToday: true,
            isSecondAttempt
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.get('/history/:chapterId', async (req, res) => {
    try {
        const supabase = getDb();
        const { data: history, error } = await supabase
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', req.user.id)
            .eq('chapter_id', req.params.chapterId)
            .order('completed_at', { ascending: false });
            
        if (error) throw error;
        res.json(history);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
