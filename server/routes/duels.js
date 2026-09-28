import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
router.use(auth);

// Obtener usuarios a los que puedes retar
router.get('/users', async (req, res) => {
    try {
        const supabase = getDb();
        const { data, error } = await supabase
            .from('users')
            .select('id, username, points')
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
        const { opponent_id, wager = 0, message = '' } = req.body;
        const challenger_id = req.user.id;
        
        if (opponent_id === challenger_id) {
            return res.status(400).json({ error: 'No puedes retarte a ti mismo' });
        }
        if (wager < 0) {
            return res.status(400).json({ error: 'Los puntos no pueden ser negativos' });
        }

        // Verificar puntos del retador
        const { data: cUser, error: cErr } = await supabase.from('users').select('points').eq('id', challenger_id).single();
        if (cErr) throw cErr;
        
        if (cUser.points < wager) {
            return res.status(400).json({ error: 'No tienes suficientes puntos para esta apuesta' });
        }

        // Generar 5 preguntas aleatorias
        const { data: questions, error: qError } = await supabase
            .from('questions')
            .select('id, chapters!inner(is_published, books!inner(is_published))')
            .eq('chapters.is_published', true)
            .eq('chapters.books.is_published', true);
            
        if (qError) throw qError;
        if (!questions || questions.length < 5) {
            return res.status(400).json({ error: 'No hay suficientes preguntas en la base de datos' });
        }
        
        const shuffled = questions.sort(() => 0.5 - Math.random());
        const selectedIds = shuffled.slice(0, 5).map(q => q.id);

        // Descontar puntos al retador
        if (wager > 0) {
            await supabase.from('users').update({ points: cUser.points - wager }).eq('id', challenger_id);
        }

        // Crear duelo
        const { data: duel, error: dError } = await supabase
            .from('duels')
            .insert([{
                challenger_id,
                opponent_id,
                questions: JSON.stringify(selectedIds),
                status: 'pending_acceptance',
                wager: wager,
                message: message
            }])
            .select()
            .single();

        if (dError) {
            // Reembolsar si falla
            if (wager > 0) await supabase.from('users').update({ points: cUser.points }).eq('id', challenger_id);
            throw dError;
        }
        
        // Notificar al oponente
        await supabase.from('notifications').insert([{
            user_id: opponent_id,
            title: '¡Nuevo Reto!',
            message: `Has sido desafiado a un Duelo Bíblico. Apuesta: ${wager} pts.`,
            link: '/duels'
        }]);

        res.json(duel);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Aceptar un duelo
router.post('/:id/accept', async (req, res) => {
    try {
        const supabase = getDb();
        const userId = req.user.id;
        const duelId = req.params.id;

        const { data: duel, error: dError } = await supabase.from('duels').select('*').eq('id', duelId).single();
        if (dError) throw dError;

        if (duel.status !== 'pending_acceptance' || duel.opponent_id !== userId) {
            return res.status(400).json({ error: 'No puedes aceptar este duelo' });
        }

        // Check puntos oponente
        const { data: userRecord, error: uErr } = await supabase.from('users').select('points').eq('id', userId).single();
        if (uErr) throw uErr;

        if (userRecord.points < duel.wager) {
            return res.status(400).json({ error: 'No tienes suficientes puntos para aceptar este duelo' });
        }

        // Descontar puntos y actualizar estado
        if (duel.wager > 0) {
            await supabase.from('users').update({ points: userRecord.points - duel.wager }).eq('id', userId);
        }

        const { error: updErr } = await supabase.from('duels').update({ status: 'pending' }).eq('id', duelId);
        if (updErr) throw updErr;

        res.json({ message: 'Duelo aceptado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Rechazar un duelo
router.post('/:id/reject', async (req, res) => {
    try {
        const supabase = getDb();
        const userId = req.user.id;
        const duelId = req.params.id;

        const { data: duel, error: dError } = await supabase.from('duels').select('*').eq('id', duelId).single();
        if (dError) throw dError;

        if (duel.status !== 'pending_acceptance' || duel.opponent_id !== userId) {
            return res.status(400).json({ error: 'No puedes rechazar este duelo' });
        }

        // Actualizar estado a rechazado
        const { error: updErr } = await supabase.from('duels').update({ status: 'rejected' }).eq('id', duelId);
        if (updErr) throw updErr;

        // Reembolsar al retador
        if (duel.wager > 0) {
            const { data: cUser } = await supabase.from('users').select('points').eq('id', duel.challenger_id).single();
            if (cUser) {
                await supabase.from('users').update({ points: cUser.points + duel.wager }).eq('id', duel.challenger_id);
            }
        }

        res.json({ message: 'Duelo rechazado' });
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

        if (duel.status === 'pending_acceptance') {
             return res.status(400).json({ error: 'Este duelo aún no ha sido aceptado' });
        }

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
            .select('id, question_text, option_a, option_b, option_c, option_d, correct_answer, verse_reference')
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
            
            // Pagar apuesta!
            const wager = duel.wager || 0;
            if (wager > 0) {
                if (updates.winner_id) {
                    const { data: wUser } = await supabase.from('users').select('points').eq('id', updates.winner_id).single();
                    if (wUser) {
                        // El ganador se lleva lo de ambos
                        await supabase.from('users').update({ points: wUser.points + (wager * 2) }).eq('id', updates.winner_id);
                    }
                } else {
                    // Empate: devolver apuesta a ambos
                    const { data: cUser } = await supabase.from('users').select('points').eq('id', duel.challenger_id).single();
                    if (cUser) await supabase.from('users').update({ points: cUser.points + wager }).eq('id', duel.challenger_id);
                    
                    const { data: oUser } = await supabase.from('users').select('points').eq('id', duel.opponent_id).single();
                    if (oUser) await supabase.from('users').update({ points: oUser.points + wager }).eq('id', duel.opponent_id);
                }
            }

            // Notificar al perdedor/ganador
            const notifUser = isChallenger ? duel.opponent_id : duel.challenger_id;
            const resultMsg = updates.winner_id === duel.challenger_id ? 'El Retador ganó.' : updates.winner_id === duel.opponent_id ? 'El Oponente ganó.' : 'Fue un empate.';
            await supabase.from('notifications').insert([{
                user_id: notifUser,
                title: 'Duelo Finalizado',
                message: `El duelo ha terminado. ${resultMsg} Apuesta: ${wager} pts.`,
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
