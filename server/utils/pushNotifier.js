import webpush from 'web-push';
import { getDb } from '../db/database.js';

// Claves VAPID oficiales de Remanente Platform (con fallback predeterminado para Netlify/Cloud)
const DEFAULT_VAPID_PUBLIC_KEY = 'BGnJ2iTANuDrhj5llCG9rB6UIzfl0odlFruACHSkIRlBsAW-yv5C2fq5cmFUq6YLPTO4lC6BdHS-N0XK9v22i3I';
const DEFAULT_VAPID_PRIVATE_KEY = '9FWM8BesjZo1ETcQ-StI0q1tQCGqde2AKPtB1XlDjZI';
const DEFAULT_VAPID_SUBJECT = 'mailto:admin@remanente.org';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT;

try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log('[PushNotifier] VAPID configurado exitosamente.');
} catch (vErr) {
    console.error('⚠️ [PushNotifier] Error inicializando VAPID:', vErr.message);
}

/**
 * Obtener las suscripciones activas de un usuario
 */
export async function getUserSubscriptions(userId) {
    const supabase = getDb();
    if (!supabase || !userId) return [];

    try {
        // 1. Intentar obtener de push_subscriptions (si la tabla dedicada existe)
        const { data: dedicatedSubs, error: dErr } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', userId);

        if (!dErr && dedicatedSubs && dedicatedSubs.length > 0) {
            return dedicatedSubs.map(s => ({
                id: s.id,
                endpoint: s.endpoint,
                keys: { p256dh: s.p256dh, auth: s.auth },
                table: 'push_subscriptions'
            }));
        }

        // 2. Fallback resiliente a tabla notifications con flag __PUSH_SUB__
        const { data: fallbackSubs, error: fErr } = await supabase
            .from('notifications')
            .select('id, link, message')
            .eq('user_id', userId)
            .eq('title', '__PUSH_SUB__');

        if (!fErr && fallbackSubs && fallbackSubs.length > 0) {
            return fallbackSubs.map(s => {
                try {
                    const parsed = JSON.parse(s.message);
                    return {
                        id: s.id,
                        endpoint: s.link || parsed.endpoint,
                        keys: parsed.keys,
                        table: 'notifications'
                    };
                } catch {
                    return null;
                }
            }).filter(Boolean);
        }
    } catch (err) {
        console.error('[PushNotifier] Error obteniendo suscripciones:', err.message);
    }

    return [];
}

/**
 * Guardar o actualizar la suscripción push de un dispositivo
 */
export async function saveUserSubscription(userId, subscription, userAgent = '') {
    const supabase = getDb();
    if (!supabase || !userId || !subscription?.endpoint) return false;

    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys?.p256dh;
    const auth = subscription.keys?.auth;

    if (!p256dh || !auth) {
        console.error('[PushNotifier] Suscripción inválida: faltan llaves');
        return false;
    }

    try {
        // 1. Intentar en push_subscriptions
        const { error: pErr } = await supabase
            .from('push_subscriptions')
            .upsert([{
                user_id: userId,
                endpoint,
                p256dh,
                auth,
                user_agent: userAgent
            }], { onConflict: 'endpoint' });

        if (!pErr) {
            return true;
        }

        // 2. Fallback resiliente en notifications
        const payload = JSON.stringify({ endpoint, keys: { p256dh, auth }, userAgent });
        const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', userId)
            .eq('title', '__PUSH_SUB__')
            .eq('link', endpoint);

        if (existing && existing.length > 0) {
            await supabase
                .from('notifications')
                .update({ message: payload, is_read: true })
                .eq('id', existing[0].id);
        } else {
            await supabase
                .from('notifications')
                .insert([{
                    user_id: userId,
                    title: '__PUSH_SUB__',
                    message: payload,
                    link: endpoint,
                    is_read: true
                }]);
        }
        return true;
    } catch (err) {
        console.error('[PushNotifier] Error guardando suscripción:', err);
        return false;
    }
}

/**
 * Eliminar una suscripción expirada o cancelada
 */
export async function removeUserSubscription(userId, endpoint, tableHint = null) {
    const supabase = getDb();
    if (!supabase || !endpoint) return;

    try {
        if (!tableHint || tableHint === 'push_subscriptions') {
            await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
        }
        if (!tableHint || tableHint === 'notifications') {
            await supabase.from('notifications').delete().eq('link', endpoint).eq('title', '__PUSH_SUB__');
        }
    } catch (err) {
        console.error('[PushNotifier] Error eliminando suscripción:', err.message);
    }
}

/**
 * Enviar notificación push a todos los dispositivos registrados de un usuario
 */
export async function sendPushNotification(userId, { title, body, icon = '/icon-192.png', url = '/', badge = '/icon-192.png', data = {} }) {
    if (!vapidPublicKey || !vapidPrivateKey) {
        console.warn('[PushNotifier] No se pueden enviar push sin claves VAPID');
        return { success: false, reason: 'no_vapid_keys' };
    }

    const subs = await getUserSubscriptions(userId);
    if (!subs || subs.length === 0) {
        return { success: false, reason: 'no_subscriptions', sent: 0 };
    }

    const notificationPayload = JSON.stringify({
        title: title || '📖 Remanente Platform',
        body: body || 'Tienes una nueva actualización en Remanente.',
        icon: icon || '/icon-192.png',
        badge: badge || '/icon-192.png',
        sound: '/notification.wav',
        silent: false,
        vibrate: [300, 100, 300, 100, 400],
        requireInteraction: true,
        data: {
            url,
            ...data,
            timestamp: Date.now()
        }
    });

    const results = await Promise.allSettled(
        subs.map(async (sub) => {
            const pushConfig = {
                endpoint: sub.endpoint,
                keys: sub.keys
            };

            try {
                await webpush.sendNotification(pushConfig, notificationPayload, {
                    TTL: 60 * 60 * 24, // 24 horas
                    urgency: 'high',
                    headers: {
                        'Urgency': 'high',
                        'Topic': 'remanente_alerts',
                        'apns-priority': '10',
                        'apns-push-type': 'alert'
                    }
                });
                return { success: true, endpoint: sub.endpoint };
            } catch (err) {
                // Si el dispositivo desinstaló la app o revocó el permiso (404 o 410)
                if (err.statusCode === 404 || err.statusCode === 410) {
                    console.log(`[PushNotifier] Endpoint expirado (${err.statusCode}), eliminando...`);
                    await removeUserSubscription(userId, sub.endpoint, sub.table);
                } else {
                    console.error('[PushNotifier] Error enviando a endpoint:', err.statusCode || err.message);
                }
                throw err;
            }
        })
    );

    const sentCount = results.filter(r => r.status === 'fulfilled').length;
    return { success: sentCount > 0, sent: sentCount, total: subs.length };
}

/**
 * Enviar notificación a TODOS los usuarios suscritos (Broadcast)
 */
export async function sendPushToAll({ title, body, icon = '/icon-192.png', url = '/' }) {
    const supabase = getDb();
    if (!supabase) return;

    try {
        const { data: users } = await supabase.from('users').select('id');
        if (!users) return;

        for (const u of users) {
            await sendPushNotification(u.id, { title, body, icon, url });
        }
    } catch (err) {
        console.error('[PushNotifier] Error en broadcast:', err);
    }
}
