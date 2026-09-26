import express from 'express';
import { getDb } from '../db/database.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
router.use(auth);

// Obtener reuniones (programadas y en vivo)
router.get('/', async (req, res) => {
    try {
        const supabase = getDb();
        const { data, error } = await supabase
            .from('meetings')
            .select(`
                id, title, description, scheduled_for, status, host_id, room_name, created_at,
                users:host_id (username)
            `)
            .in('status', ['scheduled', 'live'])
            .order('scheduled_for', { ascending: true });
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Crear una reunión (Solo admin)
router.post('/', async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'No autorizado' });
        
        const supabase = getDb();
        const { title, description, scheduled_for } = req.body;
        
        // Generar un nombre de sala único para Jitsi
        const room_name = `remanente_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const { data, error } = await supabase.from('meetings').insert([{
            title,
            description,
            scheduled_for,
            host_id: req.user.id,
            status: 'scheduled',
            room_name
        }]).select('*, users:host_id(username)').single();
        
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Cambiar estado de la reunión (Solo admin)
router.put('/:id/status', async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'No autorizado' });
        
        const supabase = getDb();
        const { status } = req.body; // 'scheduled', 'live', 'ended'
        
        const { data, error } = await supabase
            .from('meetings')
            .update({ status })
            .eq('id', req.params.id)
            .select('*, users:host_id(username)')
            .single();
            
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// Eliminar/Cancelar reunion (Solo admin)
router.delete('/:id', async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo los administradores pueden eliminar reuniones' });
        
        const supabase = getDb();
        const { error } = await supabase
            .from('meetings')
            .delete()
            .eq('id', req.params.id);
            
        if (error) throw error;
        res.json({ message: 'Reunion eliminada exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
