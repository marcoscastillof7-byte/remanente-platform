import express from 'express';
import { getDb } from '../db/database.js';

const router = express.Router();

// Endpoint público para obtener info básica de un grupo (usado en el registro)
router.get('/:slug', async (req, res) => {
    try {
        const supabase = getDb();
        const { data, error } = await supabase
            .from('groups')
            .select('id, name, slug, primary_color, secondary_color, logo_url')
            .eq('slug', req.params.slug)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
