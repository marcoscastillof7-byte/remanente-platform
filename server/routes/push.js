import express from 'express';
import { auth } from '../middleware/auth.js';
import { 
    saveUserSubscription, 
    removeUserSubscription, 
    getUserSubscriptions, 
    sendPushNotification 
} from '../utils/pushNotifier.js';

const router = express.Router();

// Ruta pública para obtener la clave pública VAPID
router.get('/vapid-key', (req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
        return res.status(500).json({ error: 'Clave VAPID pública no configurada' });
    }
    res.json({ publicKey });
});

// Todas las demás rutas requieren autenticación
router.use(auth);

// Registrar o actualizar suscripción de un dispositivo
router.post('/subscribe', async (req, res) => {
    try {
        const { subscription, userAgent } = req.body;
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Datos de suscripción incompletos' });
        }

        const success = await saveUserSubscription(req.user.id, subscription, userAgent || req.headers['user-agent']);
        if (!success) {
            return res.status(500).json({ error: 'Error al registrar suscripción push' });
        }

        res.json({ success: true, message: 'Dispositivo suscrito a notificaciones' });
    } catch (error) {
        console.error('[PushRoute] Error en /subscribe:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Cancelar suscripción de un dispositivo
router.post('/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint no especificado' });
        }

        await removeUserSubscription(req.user.id, endpoint);
        res.json({ success: true, message: 'Dispositivo desuscrito' });
    } catch (error) {
        console.error('[PushRoute] Error en /unsubscribe:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Consultar estado de suscripción del usuario
router.get('/status', async (req, res) => {
    try {
        const subs = await getUserSubscriptions(req.user.id);
        res.json({
            subscribed: subs.length > 0,
            devicesCount: subs.length
        });
    } catch (error) {
        console.error('[PushRoute] Error en /status:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Enviar notificación de prueba al usuario actual
router.post('/test', async (req, res) => {
    try {
        const result = await sendPushNotification(req.user.id, {
            title: '🔔 Remanente Platform',
            body: '¡Excelente! Las notificaciones en este dispositivo están funcionando al 100%.',
            url: '/duels',
            icon: '/favicon.svg'
        });

        if (!result.success) {
            return res.status(400).json({ 
                error: result.reason === 'no_subscriptions' 
                    ? 'No tienes ningún dispositivo registrado aún. Activa las notificaciones primero.' 
                    : 'Error enviando notificación' 
            });
        }

        res.json({ success: true, message: 'Notificación de prueba enviada', details: result });
    } catch (error) {
        console.error('[PushRoute] Error en /test:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

export default router;
