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

export default router;
