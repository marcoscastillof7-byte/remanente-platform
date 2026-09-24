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
    const { answers } = req.body; // [{questionId, selectedAnswer, timeSpent}]
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

        // Streak update
        const { data: streak } = await supabase.from('study_streaks').select('*').eq('user_id', userId).single();
        
        if (streak) {
            const today = new Date().toISOString().split('T')[0];
            const lastStudy = streak.last_study_date ? streak.last_study_date.split('T')[0] : null;

            if (lastStudy !== today) {
                let newStreak = streak.current_streak + 1;
                
                if (lastStudy) {
                    const lastDate = new Date(lastStudy);
                    const currDate = new Date(today);
                    const diffTime = Math.abs(currDate - lastDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    
                    if (diffDays > 1) {
                        newStreak = 1;
                    }
                }

                const longest = Math.max(streak.longest_streak, newStreak);
                await supabase
                    .from('study_streaks')
                    .update({ 
                        current_streak: newStreak, 
                        longest_streak: longest, 
                        last_study_date: new Date().toISOString() 
                    })
                    .eq('user_id', userId);
            }
        }
        
        // Note: Emiting socket event would happen in index.js via app.get('io')
        if (req.app.get('io')) {
            req.app.get('io').emit('leaderboard-update');
        }

        res.json({ score, correctCount, totalQuestions: answers.length, results });
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
