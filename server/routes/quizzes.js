import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';

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

        // --- POINTS LOGIC (ANTI-SPAM) ---
        let totalPointsEarned = 0;
        let quizPointsEarned = 0;
        let streakPointsEarned = 0;
        let achievementPointsEarned = 0;

        const baseQuizPoints = 10 + (correctCount * 5) + (score === 100 ? 15 : 0);

        // Check past attempts for this chapter
        const { data: pastAttempts } = await supabase
            .from('quiz_attempts')
            .select('score')
            .eq('user_id', userId)
            .eq('chapter_id', chapterId);
            
        let highestPastPoints = 0;
        if (pastAttempts && pastAttempts.length > 0) {
            highestPastPoints = pastAttempts.reduce((max, att) => {
                // Approximate past correct answers (since 15 questions is standard)
                const pastCorrect = Math.round((att.score / 100) * answers.length);
                const pts = 10 + (pastCorrect * 5) + (att.score === 100 ? 15 : 0);
                return pts > max ? pts : max;
            }, 0);
        }
        
        quizPointsEarned = Math.max(0, baseQuizPoints - highestPastPoints);
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
        const { data: streakData } = await supabase.from('study_streaks').select('*').eq('user_id', userId).single();
        let newStreak = 0;
        let longestStreak = 0;
        
        if (streakData) {
            const today = new Date().toISOString().split('T')[0];
            const lastStudy = streakData.last_study_date ? streakData.last_study_date.split('T')[0] : null;

            newStreak = streakData.current_streak;
            longestStreak = streakData.longest_streak;

            if (lastStudy !== today) {
                newStreak = streakData.current_streak + 1;
                
                if (lastStudy) {
                    const lastDate = new Date(lastStudy);
                    const currDate = new Date(today);
                    // Use round instead of ceil and ignore hours for accurate day diff
                    const diffDays = Math.round(Math.abs(currDate - lastDate) / (1000 * 60 * 60 * 24)); 
                    
                    if (diffDays > 1) {
                        newStreak = 1;
                    }
                }
                
                // Add streak points if it's a new day
                if (newStreak === 1) streakPointsEarned = 10;
                else if (newStreak === 2) streakPointsEarned = 20;
                else if (newStreak === 3) streakPointsEarned = 30;
                else if (newStreak >= 7) streakPointsEarned = 50;
                else streakPointsEarned = 40; // For days 4, 5, 6
                
                totalPointsEarned += streakPointsEarned;

                longestStreak = Math.max(streakData.longest_streak, newStreak);
                await supabase
                    .from('study_streaks')
                    .update({ 
                        current_streak: newStreak, 
                        longest_streak: longestStreak, 
                        last_study_date: new Date().toISOString() 
                    })
                    .eq('user_id', userId);
            }
        } else {
            // First time studying ever
            newStreak = 1;
            longestStreak = 1;
            streakPointsEarned = 10;
            totalPointsEarned += streakPointsEarned;
            await supabase.from('study_streaks').insert({
                user_id: userId,
                current_streak: 1,
                longest_streak: 1,
                last_study_date: new Date().toISOString()
            });
        }

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
            achievementPointsEarned
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
