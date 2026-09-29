import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';
import { superAdminOnly } from '../middleware/superAdminOnly.js';

const router = express.Router();

router.use(auth);
router.use(superAdminOnly);

// Obtener todos los grupos con métricas básicas
router.get('/groups', async (req, res) => {
    try {
        const supabase = getDb();
        const { data: groups, error: groupsError } = await supabase.from('groups').select('*').order('created_at', { ascending: true });
        
        if (groupsError) throw groupsError;

        // Obtener conteo de usuarios por grupo
        const { data: users, error: usersError } = await supabase.from('users').select('group_id');
        if (usersError) throw usersError;

        const userCounts = {};
        for (let u of users) {
            userCounts[u.group_id] = (userCounts[u.group_id] || 0) + 1;
        }

        const groupsWithCounts = groups.map(g => ({
            ...g,
            users_count: userCounts[g.id] || 0
        }));

        res.json(groupsWithCounts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno al obtener grupos' });
    }
});

// Crear un nuevo grupo
router.post('/groups', async (req, res) => {
    const { name, slug, primary_color, secondary_color } = req.body;
    
    if (!name || !slug) {
        return res.status(400).json({ error: 'El nombre y slug son obligatorios' });
    }

    try {
        const supabase = getDb();
        const { data, error } = await supabase
            .from('groups')
            .insert([{ name, slug, primary_color, secondary_color }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'El slug ya está en uso' });
            throw error;
        }

        res.status(201).json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno al crear grupo' });
    }
});

// Editar grupo
router.put('/groups/:id', async (req, res) => {
    const { name, slug, primary_color, secondary_color } = req.body;
    try {
        const supabase = getDb();
        const { data, error } = await supabase
            .from('groups')
            .update({ name, slug, primary_color, secondary_color })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'El slug ya está en uso' });
            throw error;
        }
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno al actualizar grupo' });
    }
});

// Obtener integrantes de un grupo
router.get('/groups/:id/users', async (req, res) => {
    try {
        const supabase = getDb();
        const { data, error } = await supabase
            .from('users')
            .select('id, username, email, role, points, created_at')
            .eq('group_id', req.params.id)
            .order('username', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno al obtener integrantes' });
    }
});

// Actualizar rol y grupo de un usuario
router.put('/users/:userId', async (req, res) => {
    const { role, group_id } = req.body;
    try {
        const supabase = getDb();
        const { data, error } = await supabase
            .from('users')
            .update({ role, group_id })
            .eq('id', req.params.userId)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno al actualizar usuario' });
    }
});

// Eliminar un grupo y TODOS sus usuarios y datos (Cascada manual)
router.delete('/groups/:id', async (req, res) => {
    try {
        const supabase = getDb();
        const groupId = req.params.id;

        // 1. Obtener usuarios del grupo
        const { data: users } = await supabase.from('users').select('id').eq('group_id', groupId);
        
        if (users && users.length > 0) {
            const userIds = users.map(u => u.id);

            // Eliminar datos relacionados con usuarios
            await supabase.from('essay_responses').delete().in('user_id', userIds);
            await supabase.from('flashcard_progress').delete().in('user_id', userIds);
            await supabase.from('user_achievements').delete().in('user_id', userIds);
            await supabase.from('user_notes').delete().in('user_id', userIds);
            await supabase.from('study_streaks').delete().in('user_id', userIds);
            await supabase.from('custom_quiz_configs').delete().in('user_id', userIds);

            // Quizzes normales
            const { data: attempts } = await supabase.from('quiz_attempts').select('id').in('user_id', userIds);
            if (attempts && attempts.length > 0) {
                const attemptIds = attempts.map(a => a.id);
                await supabase.from('quiz_answers').delete().in('attempt_id', attemptIds);
            }
            await supabase.from('quiz_attempts').delete().in('user_id', userIds);

            // Quizzes personalizados
            const { data: cAttempts } = await supabase.from('custom_quiz_attempts').select('id').in('user_id', userIds);
            if (cAttempts && cAttempts.length > 0) {
                const cAttemptIds = cAttempts.map(a => a.id);
                await supabase.from('custom_quiz_answers').delete().in('attempt_id', cAttemptIds);
            }
            await supabase.from('custom_quiz_attempts').delete().in('user_id', userIds);

            // Finalmente, eliminar los usuarios
            await supabase.from('users').delete().in('id', userIds);
        }

        // 2. Eliminar Preguntas Extendidas del grupo
        const { data: questions } = await supabase.from('essay_questions').select('id').eq('group_id', groupId);
        if (questions && questions.length > 0) {
            const questionIds = questions.map(q => q.id);
            await supabase.from('essay_responses').delete().in('question_id', questionIds);
            await supabase.from('essay_questions').delete().eq('group_id', groupId);
        }

        // 3. Eliminar el grupo
        const { error: groupError } = await supabase.from('groups').delete().eq('id', groupId);
        if (groupError) throw groupError;

        res.json({ message: 'Grupo y todos sus datos fueron eliminados exitosamente' });
    } catch (error) {
        console.error('Error al eliminar grupo:', error);
        res.status(500).json({ error: 'Error interno al eliminar el grupo y sus datos' });
    }
});

// Eliminar un solo usuario y todos sus datos en cascada manual
router.delete('/users/:userId', async (req, res) => {
    try {
        const supabase = getDb();
        const userId = req.params.userId;

        // Eliminar datos relacionados con este usuario
        await supabase.from('essay_responses').delete().eq('user_id', userId);
        await supabase.from('flashcard_progress').delete().eq('user_id', userId);
        await supabase.from('user_achievements').delete().eq('user_id', userId);
        await supabase.from('user_notes').delete().eq('user_id', userId);
        await supabase.from('study_streaks').delete().eq('user_id', userId);
        await supabase.from('custom_quiz_configs').delete().eq('user_id', userId);

        // Quizzes normales
        const { data: attempts } = await supabase.from('quiz_attempts').select('id').eq('user_id', userId);
        if (attempts && attempts.length > 0) {
            const attemptIds = attempts.map(a => a.id);
            await supabase.from('quiz_answers').delete().in('attempt_id', attemptIds);
        }
        await supabase.from('quiz_attempts').delete().eq('user_id', userId);

        // Quizzes personalizados
        const { data: cAttempts } = await supabase.from('custom_quiz_attempts').select('id').eq('user_id', userId);
        if (cAttempts && cAttempts.length > 0) {
            const cAttemptIds = cAttempts.map(a => a.id);
            await supabase.from('custom_quiz_answers').delete().in('attempt_id', cAttemptIds);
        }
        await supabase.from('custom_quiz_attempts').delete().eq('user_id', userId);

        // Finalmente, eliminar el usuario
        const { error: delError } = await supabase.from('users').delete().eq('id', userId);
        if (delError) throw delError;

        res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error interno al eliminar el usuario' });
    }
});

export default router;
