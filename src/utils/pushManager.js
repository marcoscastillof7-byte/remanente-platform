import { api } from './api';

/**
 * Convierte la clave pública VAPID en base64 a Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Verifica si el navegador actual soporta Web Push
 */
export function isPushSupported() {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

/**
 * Detecta si el dispositivo es un iPhone o iPad (iOS)
 */
export function isIOSDevice() {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Detecta si la web se está ejecutando como PWA instalada en pantalla de inicio
 */
export function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || 
    window.navigator.standalone === true;
}

/**
 * Registra el Service Worker de la aplicación
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    return registration;
  } catch (error) {
    console.error('Error registrando Service Worker:', error);
    return null;
  }
}

/**
 * Obtiene el estado actual de las notificaciones push en este dispositivo
 */
export async function getPushStatus() {
  if (!isPushSupported()) {
    return {
      supported: false,
      permission: 'unsupported',
      isSubscribed: false,
      isIOS: isIOSDevice(),
      isStandalone: isStandalonePWA()
    };
  }

  const permission = Notification.permission;
  let isSubscribed = false;

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      isSubscribed = !!sub;
    }
  } catch (err) {
    console.error('Error verificando suscripción:', err);
  }

  return {
    supported: true,
    permission,
    isSubscribed,
    isIOS: isIOSDevice(),
    isStandalone: isStandalonePWA()
  };
}

/**
 * Suscribe este dispositivo a notificaciones push
 */
export async function subscribeToPushNotifications() {
  if (!isPushSupported()) {
    throw new Error('Tu navegador o dispositivo no soporta notificaciones push web.');
  }

  // 1. Solicitar permiso al usuario
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('El permiso de notificaciones fue denegado.');
  }

  // 2. Asegurar registro del Service Worker
  let reg = await navigator.serviceWorker.ready;
  if (!reg) {
    reg = await registerServiceWorker();
    reg = await navigator.serviceWorker.ready;
  }

  // 3. Obtener clave pública VAPID
  const { publicKey } = await api.get('/push/vapid-key', false);
  if (!publicKey) {
    throw new Error('No se pudo obtener la clave VAPID del servidor.');
  }

  // 4. Suscribir en el PushManager del navegador
  const convertedVapidKey = urlBase64ToUint8Array(publicKey);
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey
  });

  // 5. Enviar credencial al servidor
  await api.post('/push/subscribe', {
    subscription: subscription.toJSON(),
    userAgent: navigator.userAgent
  });

  return subscription;
}

/**
 * Cancela la suscripción de este dispositivo
 */
export async function unsubscribeFromPushNotifications() {
  if (!isPushSupported()) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await api.post('/push/unsubscribe', { endpoint });
    }
    return true;
  } catch (err) {
    console.error('Error desuscribiendo:', err);
    throw err;
  }
}

/**
 * Enviar notificación de prueba inmediata
 */
export async function sendTestPush() {
  return await api.post('/push/test', {});
}
