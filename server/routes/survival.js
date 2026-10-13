import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
router.use(auth);

// Iniciar supervivencia (obtener preguntas aleatorias)
router.get('/start', async (req, res) => {
    try {
        const supabase = getDb();
        
        // Obtenemos una muestra grande de preguntas (50) para el cliente con la información de libro y capítulo
        const { data: questions, error } = await supabase
            .from('questions')
            .select(`
                id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, verse_reference,
                chapters!inner (
                    is_published,
                    chapter_number,
                    books!inner ( name, is_published )
                )
            `)
            .eq('chapters.is_published', true)
            .eq('chapters.books.is_published', true);
            
        if (error) throw error;

        // Shuffle
        const shuffled = questions.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 100); // Hasta 100 preguntas de golpe
        
        res.json(selected);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Guardar récord de supervivencia y sumar puntos al usuario
router.post('/submit', async (req, res) => {
    try {
        const supabase = getDb();
        const userId = req.user.id;
        const rawScore = req.body.score;
        const score = Math.max(0, parseInt(rawScore, 10) || 0);

        // En Supervivencia: +10 puntos por cada pregunta respondida correctamente
        const pointsEarned = score * 10;
        
        // 1. Guardar intento en la tabla de records
        const { error: insertErr } = await supabase.from('survival_attempts').insert([{
            user_id: userId,
            score
        }]);
        
        if (insertErr) throw insertErr;

        // 2. Sumar puntos al perfil del usuario (Tabla de Honor)
        let newTotalPoints = 0;
        const { data: u, error: uErr } = await supabase
            .from('users')
            .select('points')
            .eq('id', userId)
            .single();

        if (!uErr && u) {
            const currentPoints = (typeof u.points === 'number') ? u.points : 0;
            newTotalPoints = currentPoints + pointsEarned;
            if (pointsEarned > 0) {
                await supabase.from('users').update({ points: newTotalPoints }).eq('id', userId);
            }
        }

        // Invalidar caché de leaderboard
        cache.lastUpdated = 0;

        // Notificar en tiempo real por sockets
        if (req.app.get('io')) {
            req.app.get('io').emit('leaderboard-update');
        }

        res.json({ 
            success: true, 
            message: 'Récord guardado exitosamente', 
            score, 
            pointsEarned, 
            newTotalPoints 
        });
    } catch (error) {
        console.error('[SurvivalRoute] Error en /submit:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Caché para leaderboard de supervivencia
const SURVIVAL_CACHE_TTL = 60000; // 1 minuto
const cache = {
    leaderboard: null,
    lastUpdated: 0
};

// Tabla de posiciones de supervivencia
router.get('/leaderboard', async (req, res) => {
    try {
        const now = Date.now();
        if (cache.leaderboard && (now - cache.lastUpdated < SURVIVAL_CACHE_TTL)) {
            return res.json(cache.leaderboard);
        }

        const supabase = getDb();
        
        // Obtener los mejores scores únicos por usuario
        const { data, error } = await supabase
            .from('survival_attempts')
            .select('score, completed_at, user_id, users(username)')
            .order('score', { ascending: false });
            
        if (error) throw error;
        
        // Agrupar por usuario y tomar el máximo
        const bestScores = {};
        for(let attempt of data) {
            if(!bestScores[attempt.user_id]) {
                bestScores[attempt.user_id] = attempt;
            }
        }
        
        const top10 = Object.values(bestScores)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
            
        cache.leaderboard = top10;
        cache.lastUpdated = now;
        
        res.json(top10);
    } catch (error) {
        console.error('Error in /survival/leaderboard:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
