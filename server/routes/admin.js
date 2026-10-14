import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import { getLocalDate, getDaysDiff, getSafeUserStreak } from '../utils/streaks.js';

const router = express.Router();
router.use(auth);
router.use(adminOnly);

// Auto-enable chapter and book when questions are updated
const autoPublishChapter = async (supabase, chapterId) => {
    try {
        await supabase.from('chapters').update({ is_published: true }).eq('id', chapterId);
        const { data: chapter } = await supabase.from('chapters').select('book_id').eq('id', chapterId).single();
        if (chapter) {
            await supabase.from('books').update({ is_published: true }).eq('id', chapter.book_id);
        }
    } catch (e) {
        console.error('Error auto-publishing chapter:', e);
    }
};

router.get('/users', async (req, res) => {
    try {
        const supabase = getDb();
        let query = supabase.from('users').select('id, username, email, role, created_at, last_active, points, group_id, groups(name)');
        
        if (req.user.role !== 'superadmin') {
            query = query.eq('group_id', req.user.group_id);
        }

        const { data: users, error: uError } = await query;
        if (uError) throw uError;

        const { data: attempts } = await supabase.from('quiz_attempts').select('user_id, score, completed_at');
        const { data: streaks } = await supabase.from('study_streaks').select('user_id, current_streak, longest_streak, last_study_date');
        const { data: survivalAttempts } = await supabase.from('survival_attempts').select('user_id, score');
        const { data: duels } = await supabase.from('duels').select('challenger_id, opponent_id, winner_id, status').eq('status', 'completed');

        const today = getLocalDate(new Date());

        const result = (users || []).map(u => {
            const userAttempts = attempts ? attempts.filter(a => a.user_id === u.id) : [];
            const userStreak = streaks ? streaks.find(s => s.user_id === u.id) : null;
            const userSurvival = survivalAttempts ? survivalAttempts.filter(s => s.user_id === u.id) : [];
            const userDuels = duels ? duels.filter(d => d.challenger_id === u.id || d.opponent_id === u.id) : [];
            const duelsWon = userDuels.filter(d => d.winner_id === u.id).length;
            
            const total_quizzes = userAttempts.length;
            const totalScore = userAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
            const avg_score = total_quizzes > 0 ? Math.round(totalScore / total_quizzes) : 0;
            const passed_quizzes = userAttempts.filter(a => (a.score || 0) >= 80).length;
            const pass_rate = total_quizzes > 0 ? Math.round((passed_quizzes / total_quizzes) * 100) : 0;

            let activeStreak = 0;
            if (userStreak && userStreak.last_study_date) {
                const lastDay = getLocalDate(userStreak.last_study_date);
                const diff = getDaysDiff(lastDay, today);
                if (diff === 0 || diff === 1) {
                    activeStreak = userStreak.current_streak || 0;
                }
            }

            // Find last active date across attempts, userStreak, and u.last_active
            const dates = [];
            if (u.last_active) dates.push(new Date(u.last_active));
            if (userStreak?.last_study_date) dates.push(new Date(userStreak.last_study_date));
            userAttempts.forEach(a => {
                if (a.completed_at) dates.push(new Date(a.completed_at));
            });
            const lastActiveDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))).toISOString() : null;

            const bestSurvival = userSurvival.length > 0 ? Math.max(...userSurvival.map(s => s.score || 0)) : 0;

            return {
                ...u,
                group_name: u.groups?.name || null,
                total_quizzes,
                passed_quizzes,
                pass_rate,
                avg_score,
                current_streak: activeStreak,
                longest_streak: userStreak?.longest_streak || activeStreak,
                survival_best: bestSurvival,
                duels_played: userDuels.length,
                duels_won: duelsWon,
                last_active: lastActiveDate
            };
        }).sort((a, b) => (b.points || 0) - (a.points || 0));

        res.json(result);
    } catch (error) {
        console.error('Error in /admin/users:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.get('/users/:userId/performance', async (req, res) => {
    try {
        const supabase = getDb();
        const userId = parseInt(req.params.userId, 10);

        const { data: user, error: uError } = await supabase
            .from('users')
            .select('id, username, email, role, points, created_at, last_active, group_id, groups(name)')
            .eq('id', userId)
            .single();

        if (uError || !user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (req.user.role !== 'superadmin' && user.group_id !== req.user.group_id) {
            return res.status(403).json({ error: 'No tienes permiso para ver este usuario' });
        }

        const { data: attempts } = await supabase
            .from('quiz_attempts')
            .select('id, score, total_questions, chapter_id, completed_at, chapters(id, chapter_number, title, book_id, books(id, name))')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false });

        const streak = await getSafeUserStreak(supabase, userId);
        const { data: books } = await supabase.from('books').select('*').order('order_index');
        const { data: chapters } = await supabase.from('chapters').select('id, chapter_number, title, book_id').order('chapter_number');

        // Cargar logros del usuario
        const { data: achievements } = await supabase
            .from('user_achievements')
            .select('earned_at, achievements(id, name, icon, description)')
            .eq('user_id', userId)
            .order('earned_at', { ascending: false });

        // Cargar supervivencia
        const { data: survivalAttempts } = await supabase
            .from('survival_attempts')
            .select('id, score, started_at, completed_at')
            .eq('user_id', userId)
            .order('score', { ascending: false });

        // Cargar duelos
        const { data: duels } = await supabase
            .from('duels')
            .select('id, challenger_id, opponent_id, winner_id, status, wager, created_at')
            .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
            .eq('status', 'completed')
            .order('created_at', { ascending: false });

        // Notas y flashcards
        const { count: notesCount } = await supabase
            .from('user_notes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);

        const { count: flashcardsCount } = await supabase
            .from('flashcard_progress')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);

        const userAttemptsList = attempts || [];
        const total_quizzes = userAttemptsList.length;
        const totalScore = userAttemptsList.reduce((sum, a) => sum + (a.score || 0), 0);
        const avg_score = total_quizzes > 0 ? Math.round(totalScore / total_quizzes) : 0;
        const passed_quizzes = userAttemptsList.filter(a => (a.score || 0) >= 80).length;
        const perfect_quizzes = userAttemptsList.filter(a => (a.score || 0) === 100).length;
        const pass_rate = total_quizzes > 0 ? Math.round((passed_quizzes / total_quizzes) * 100) : 0;

        // Intentos recientes formateados
        const recent_attempts = userAttemptsList.slice(0, 20).map(a => ({
            id: a.id,
            score: a.score,
            total_questions: a.total_questions,
            completed_at: a.completed_at,
            chapter_id: a.chapter_id,
            chapter_number: a.chapters?.chapter_number || null,
            chapter_title: a.chapters?.title || null,
            book_name: a.chapters?.books?.name || 'Bíblico'
        }));

        // Duelos
        const duelsList = duels || [];
        const duels_played = duelsList.length;
        const duels_won = duelsList.filter(d => d.winner_id === userId).length;
        const duels_lost = duels_played - duels_won;
        const duel_win_rate = duels_played > 0 ? Math.round((duels_won / duels_played) * 100) : 0;

        // Supervivencia
        const survivalList = survivalAttempts || [];
        const survival_games = survivalList.length;
        const best_survival_score = survivalList.length > 0 ? Math.max(...survivalList.map(s => s.score || 0)) : 0;

        // Desglose por libros y capítulos
        const booksData = (books || []).map(book => {
            const bookChapters = (chapters || []).filter(c => c.book_id === book.id).sort((a, b) => a.chapter_number - b.chapter_number);
            let chaptersAttempted = 0;
            let chaptersPassed = 0;
            let bookTotalScore = 0;
            let bookAttemptsCount = 0;

            const chaptersDetail = bookChapters.map(c => {
                const cAttempts = userAttemptsList.filter(a => a.chapter_id === c.id);
                const attemptsCount = cAttempts.length;
                if (attemptsCount > 0) chaptersAttempted++;

                const cTotalScore = cAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
                const cBestScore = attemptsCount > 0 ? Math.max(...cAttempts.map(a => a.score)) : null;
                const cAvgScore = attemptsCount > 0 ? Math.round(cTotalScore / attemptsCount) : null;
                const isPassed = cBestScore !== null && cBestScore >= 80;
                if (isPassed) chaptersPassed++;

                if (attemptsCount > 0) {
                    bookTotalScore += cTotalScore;
                    bookAttemptsCount += attemptsCount;
                }

                const cLastAttempt = attemptsCount > 0
                    ? [...cAttempts].sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))[0].completed_at
                    : null;

                return {
                    chapter_id: c.id,
                    chapter_number: c.chapter_number,
                    title: c.title,
                    attempts: attemptsCount,
                    best_score: cBestScore,
                    avg_score: cAvgScore,
                    is_passed: isPassed,
                    last_attempt: cLastAttempt
                };
            });

            const totalBookChapters = bookChapters.length;
            const completionPercentage = totalBookChapters > 0 ? Math.round((chaptersPassed / totalBookChapters) * 100) : 0;
            const bookAvgScore = bookAttemptsCount > 0 ? Math.round(bookTotalScore / bookAttemptsCount) : 0;

            return {
                id: book.id,
                name: book.name,
                slug: book.slug,
                description: book.description,
                chapters_count: totalBookChapters,
                chapters_passed: chaptersPassed,
                chapters_attempted: chaptersAttempted,
                completion_percentage: completionPercentage,
                avg_score: bookAvgScore,
                chapters: chaptersDetail
            };
        });

        // Actividad más reciente
        const activityDates = [];
        if (user.last_active) activityDates.push(new Date(user.last_active));
        if (streak?.last_study_date) activityDates.push(new Date(streak.last_study_date));
        userAttemptsList.forEach(a => { if (a.completed_at) activityDates.push(new Date(a.completed_at)); });
        const last_active = activityDates.length > 0 ? new Date(Math.max(...activityDates.map(d => d.getTime()))).toISOString() : null;

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            points: user.points || 0,
            created_at: user.created_at,
            group_name: user.groups?.name || null,
            total_quizzes,
            passed_quizzes,
            perfect_quizzes,
            pass_rate,
            avg_score,
            current_streak: streak ? streak.current_streak : 0,
            longest_streak: streak ? streak.longest_streak : 0,
            last_active,
            notes_count: notesCount || 0,
            flashcards_count: flashcardsCount || 0,
            survival: {
                games_played: survival_games,
                best_score: best_survival_score
            },
            duels: {
                played: duels_played,
                won: duels_won,
                lost: duels_lost,
                win_rate: duel_win_rate
            },
            recent_attempts,
            achievements: achievements ? achievements.map(a => ({
                id: a.achievements.id,
                name: a.achievements.name,
                icon: a.achievements.icon,
                description: a.achievements.description,
                earned_at: a.earned_at
            })) : [],
            books: booksData
        });
    } catch (error) {
        console.error('Error in /admin/users/:userId/performance:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const supabase = getDb();
        
        let usersQuery = supabase.from('users').select('id, points', { count: 'exact' });
        if (req.user.role !== 'superadmin') {
            usersQuery = usersQuery.eq('group_id', req.user.group_id);
        }
        
        const { data: usersList, count: total_users } = await usersQuery;
        
        // Only get attempts for the users in the current scope
        let attemptsQuery = supabase.from('quiz_attempts').select('score, user_id, completed_at');
        
        if (req.user.role !== 'superadmin' && usersList && usersList.length > 0) {
            const userIds = usersList.map(u => u.id);
            attemptsQuery = attemptsQuery.in('user_id', userIds);
        } else if (req.user.role !== 'superadmin' && (!usersList || usersList.length === 0)) {
            // No users in group, so no attempts
            return res.json({ total_users: 0, total_quizzes: 0, avg_score: 0, active_users: 0, pass_rate: 0, total_points: 0 });
        }

        const { data: attempts } = await attemptsQuery;

        let total_quizzes = 0;
        let avg_score = 0;
        let active_users = 0;
        let pass_rate = 0;
        let total_points = (usersList || []).reduce((sum, u) => sum + (u.points || 0), 0);

        if (attempts && attempts.length > 0) {
            total_quizzes = attempts.length;
            const totalScore = attempts.reduce((sum, a) => sum + (a.score || 0), 0);
            avg_score = Math.round(totalScore / total_quizzes);
            const passedCount = attempts.filter(a => (a.score || 0) >= 80).length;
            pass_rate = Math.round((passedCount / total_quizzes) * 100);

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const activeUserIds = new Set(
                attempts
                    .filter(a => new Date(a.completed_at) >= sevenDaysAgo)
                    .map(a => a.user_id)
            );
            active_users = activeUserIds.size;
        }

        res.json({
            total_users: total_users || 0,
            total_quizzes,
            avg_score,
            active_users,
            pass_rate,
            total_points
        });
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

// ==========================================
// RUTAS DE GESTIÓN (Solo Admins)
// ==========================================
router.use(adminOnly);

router.post('/questions', async (req, res) => {
    try {
        const supabase = getDb();
        const { chapter_id, question_text, option_a, option_b, option_c, option_d, correct_answer, difficulty, explanation, verse_reference } = req.body;
        
        const { data, error } = await supabase.from('questions').insert([{
            chapter_id, question_text, option_a, option_b, option_c, option_d, correct_answer, difficulty, explanation, verse_reference
        }]).select().single();

        if (error) throw error;
        
        await autoPublishChapter(supabase, chapter_id);
        
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
        
        await autoPublishChapter(supabase, chapterId);

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

        // Activar (publicar) automáticamente los capítulos y libros importados
        try {
            const chapterIds = [...new Set(questions.map(q => q.chapter_id))];
            if (chapterIds.length > 0) {
                // Activar los capítulos
                await supabase.from('chapters').update({ is_published: true }).in('id', chapterIds);
                
                // Buscar los book_ids de esos capítulos y activarlos también
                const { data: chapsData } = await supabase.from('chapters').select('book_id').in('id', chapterIds);
                if (chapsData && chapsData.length > 0) {
                    const bookIds = [...new Set(chapsData.map(c => c.book_id))];
                    await supabase.from('books').update({ is_published: true }).in('id', bookIds);
                }
            }
        } catch (pubErr) {
            console.error("Error activando capítulos y libros:", pubErr);
        }

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
        
        // Find chapter_id for this question and publish it
        const { data: q } = await supabase.from('questions').select('chapter_id').eq('id', req.params.id).single();
        if (q && q.chapter_id) {
            await autoPublishChapter(supabase, q.chapter_id);
        }
        
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

// Endpoint para guardar video_url masivamente en capitulos
router.post('/chapter-videos', async (req, res) => {
    try {
        const supabase = getDb();
        const { videoUrl, chapterIds } = req.body;
        
        if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
            return res.status(400).json({ error: 'Lista de capítulos vacía' });
        }
        
        const { error } = await supabase
            .from('chapters')
            .update({ video_url: videoUrl })
            .in('id', chapterIds);
            
        if (error) throw error;
        res.json({ message: 'Videos asignados a capítulos exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno asignando videos' });
    }
});

// Endpoint para guardar video_url masivamente en libros
router.post('/book-videos', async (req, res) => {
    try {
        const supabase = getDb();
        const { videoUrl, bookIds } = req.body;
        
        if (!Array.isArray(bookIds) || bookIds.length === 0) {
            return res.status(400).json({ error: 'Lista de libros vacía' });
        }
        
        const { error } = await supabase
            .from('books')
            .update({ video_url: videoUrl })
            .in('id', bookIds);
            
        if (error) throw error;
        res.json({ message: 'Videos asignados a libros exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno asignando videos' });
    }
});

export default router;
