import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
router.use(auth);

// Obtener usuarios a los que puedes retar (excluyendo a ti mismo y admins si quieres)
router.get('/users', async (req, res) => {
    try {
        const supabase = getDb();
        const { data, error } = await supabase
            .from('users')
            .select('id, username')
            .neq('id', req.user.id)
            .order('username');
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Obtener tus duelos (pendientes y completados)
router.get('/', async (req, res) => {
    try {
        const supabase = getDb();
        const userId = req.user.id;
        
        // Obtener duelos donde seas retador u oponente
        const { data, error } = await supabase
            .from('duels')
            .select(`
                *,
                challenger:users!challenger_id(username),
                opponent:users!opponent_id(username),
                winner:users!winner_id(username)
            `)
            .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Retar a un usuario
router.post('/challenge', async (req, res) => {
    try {
        const supabase = getDb();
        const { opponent_id } = req.body;
        const challenger_id = req.user.id;
        
        if (opponent_id === challenger_id) {
            return res.status(400).json({ error: 'No puedes retarte a ti mismo' });
        }

        // Generar 5 preguntas aleatorias
        const { data: questions, error: qError } = await supabase
            .from('questions')
            .select('id');
            
        if (qError) throw qError;
        if (!questions || questions.length < 5) {
            return res.status(400).json({ error: 'No hay suficientes preguntas en la base de datos' });
        }
        
        const shuffled = questions.sort(() => 0.5 - Math.random());
        const selectedIds = shuffled.slice(0, 5).map(q => q.id);

        // Crear duelo
        const { data: duel, error: dError } = await supabase
            .from('duels')
            .insert([{
                challenger_id,
                opponent_id,
                questions: JSON.stringify(selectedIds),
                status: 'pending'
            }])
            .select()
            .single();

        if (dError) throw dError;
        
        // Notificar al oponente
        await supabase.from('notifications').insert([{
            user_id: opponent_id,
            title: '¡Nuevo Reto!',
            message: 'Has sido desafiado a un Duelo Bíblico. ¡Demuestra lo que sabes!',
            link: '/duels'
        }]);

        res.json(duel);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Iniciar un duelo (obtener las preguntas reales)
router.get('/:id/play', async (req, res) => {
    try {
        const supabase = getDb();
        const userId = req.user.id;
        const duelId = req.params.id;

        const { data: duel, error: dError } = await supabase
            .from('duels')
            .select('*')
            .eq('id', duelId)
            .single();
            
        if (dError) throw dError;

        // Verificar permisos
        if (duel.challenger_id !== userId && duel.opponent_id !== userId) {
            return res.status(403).json({ error: 'No tienes permiso para jugar este duelo' });
        }

        // Verificar si ya lo jugó
        if (duel.challenger_id === userId && duel.challenger_completed) {
            return res.status(400).json({ error: 'Ya jugaste este duelo' });
        }
        if (duel.opponent_id === userId && duel.opponent_completed) {
            return res.status(400).json({ error: 'Ya jugaste este duelo' });
        }

        const questionIds = JSON.parse(duel.questions);
        
        const { data: questions, error: qError } = await supabase
            .from('questions')
            .select('id, question_text, option_a, option_b, option_c, option_d, correct_answer')
            .in('id', questionIds);

        if (qError) throw qError;
        
        // Mantener el orden original
        const orderedQuestions = questionIds.map(id => questions.find(q => q.id === id)).filter(Boolean);
        
        res.json({ duel, questions: orderedQuestions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Enviar resultados de duelo
router.post('/:id/submit', async (req, res) => {
    try {
        const supabase = getDb();
        const userId = req.user.id;
        const duelId = req.params.id;
        const { score, time_spent } = req.body;

        const { data: duel, error: dError } = await supabase
            .from('duels')
            .select('*')
            .eq('id', duelId)
            .single();
            
        if (dError) throw dError;

        const updates = {};
        let isChallenger = false;

        if (duel.challenger_id === userId) {
            updates.challenger_score = score;
            updates.challenger_time = time_spent;
            updates.challenger_completed = 1;
            isChallenger = true;
        } else if (duel.opponent_id === userId) {
            updates.opponent_score = score;
            updates.opponent_time = time_spent;
            updates.opponent_completed = 1;
        } else {
            return res.status(403).json({ error: 'No autorizado' });
        }

        // Determinar ganador si ambos terminaron
        const bothCompleted = (isChallenger ? 1 : duel.challenger_completed) && (!isChallenger ? 1 : duel.opponent_completed);
        
        if (bothCompleted) {
            updates.status = 'completed';
            const cScore = isChallenger ? score : duel.challenger_score;
            const cTime = isChallenger ? time_spent : duel.challenger_time;
            const oScore = !isChallenger ? score : duel.opponent_score;
            const oTime = !isChallenger ? time_spent : duel.opponent_time;

            if (cScore > oScore) {
                updates.winner_id = duel.challenger_id;
            } else if (oScore > cScore) {
                updates.winner_id = duel.opponent_id;
            } else {
                // Empate en puntos, gana el menor tiempo
                if (cTime < oTime) updates.winner_id = duel.challenger_id;
                else if (oTime < cTime) updates.winner_id = duel.opponent_id;
                else updates.winner_id = null; // Empate total
            }
            
            // Notificar al perdedor/ganador
            const notifUser = isChallenger ? duel.opponent_id : duel.challenger_id;
            const resultMsg = updates.winner_id === duel.challenger_id ? 'El Retador ganó.' : updates.winner_id === duel.opponent_id ? 'El Oponente ganó.' : 'Fue un empate.';
            await supabase.from('notifications').insert([{
                user_id: notifUser,
                title: 'Duelo Finalizado',
                message: `El duelo ha terminado. ${resultMsg}`,
                link: '/duels'
            }]);
        } else if (!isChallenger) {
            updates.status = 'active'; // Si el oponente juega primero
        }

        const { error: uError } = await supabase.from('duels').update(updates).eq('id', duelId);
        if (uError) throw uError;

        res.json({ message: 'Resultados guardados', winner_id: updates.winner_id, status: updates.status || duel.status });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
