export const superAdminOnly = (req, res, next) => {
    // Solo 'Marcos' puede acceder al panel de MegaAdmin
    if (req.user && req.user.username?.toLowerCase() === 'marcos') {
        next();
    } else {
        return res.status(403).json({ error: 'Acceso denegado. Solo Marcos (MegaAdmin) tiene acceso a este panel.' });
    }
};
