import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
const SECRET = 'remanente_jwt_secret_2024';

router.post('/register', async (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    try {
        const supabase = getDb();
        const hashedPassword = await bcrypt.hash(password, 10);

        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{ username, email, password_hash: hashedPassword, role: 'user' }])
            .select()
            .single();

        if (insertError) {
            if (insertError.code === '23505') { // Postgres Unique Violation
                return res.status(400).json({ error: 'El usuario ya existe' });
            }
            throw insertError;
        }

        const userId = newUser.id;

        const { error: streakError } = await supabase
            .from('study_streaks')
            .insert([{ user_id: userId }]);
            
        if (streakError) throw streakError;

        const user = { id: userId, username, role: 'user', email };
        const token = jwt.sign(user, SECRET, { expiresIn: '24h' });

        res.status(201).json({ token, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    try {
        const supabase = getDb();
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const userData = { id: user.id, username: user.username, role: user.role };
        const token = jwt.sign(userData, SECRET, { expiresIn: '24h' });

        // Update last_active timestamp
        await supabase.from('users').update({ last_active: new Date().toISOString() }).eq('id', user.id);

        res.json({ token, user: userData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/profile', auth, async (req, res) => {
    try {
        const supabase = getDb();
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, username, email, role, created_at')
            .eq('id', req.user.id)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const { data: streak } = await supabase
            .from('study_streaks')
            .select('*')
            .eq('user_id', req.user.id)
            .single();

        const { data: attempts } = await supabase
            .from('quiz_attempts')
            .select('score')
            .eq('user_id', req.user.id);
            
        const total_quizzes = attempts ? attempts.length : 0;
        const avg_score = total_quizzes > 0 ? Math.round(attempts.reduce((acc, curr) => acc + (curr.score || 0), 0) / total_quizzes) : 0;

        // Obtain all system achievements
        const { data: allAchievements } = await supabase.from('achievements').select('*');
        
        // Obtain user unlocked achievements
        const { data: userAchievements } = await supabase
            .from('user_achievements')
            .select('achievement_id, earned_at')
            .eq('user_id', req.user.id);
            
        const unlockedMap = {};
        for (let ua of (userAchievements || [])) {
            unlockedMap[ua.achievement_id] = ua.earned_at;
        }

        const achievementsList = (allAchievements || []).map(a => ({
            ...a,
            unlocked: !!unlockedMap[a.id],
            earned_at: unlockedMap[a.id] || null
        }));

        res.json({ 
            ...user, 
            streak, 
            stats: { total_quizzes, avg_score, current_streak: streak?.current_streak || 0 },
            achievements: achievementsList 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.put('/profile', auth, async (req, res) => {
    const { email } = req.body;
    try {
        const supabase = getDb();
        const { error } = await supabase
            .from('users')
            .update({ email })
            .eq('id', req.user.id);
            
        if (error) throw error;
        
        res.json({ message: 'Perfil actualizado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

export default router;
