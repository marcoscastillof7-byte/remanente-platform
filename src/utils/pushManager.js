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
  if (typeof window === 'undefined') return false;
  // Soporte directo estándar
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
    return true;
  }
  // En iOS, el dispositivo SÍ lo soporta a través de PWA en pantalla de inicio (iOS 16.4+)
  if (isIOSDevice()) {
    return true;
  }
  return false;
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
  const isIOS = isIOSDevice();
  const isStandalone = isStandalonePWA();
  const hasNativePush = typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  // Si no tiene APIs nativas y NO es iOS, no está soportado
  if (!hasNativePush && !isIOS) {
    return {
      supported: false,
      permission: 'unsupported',
      isSubscribed: false,
      isIOS: false,
      isStandalone: false,
      needsIOSInstall: false
    };
  }

  // Si es iOS pero está abierto en Safari regular (no en pantalla de inicio)
  if (isIOS && !isStandalone) {
    return {
      supported: true,
      permission: 'default',
      isSubscribed: false,
      isIOS: true,
      isStandalone: false,
      needsIOSInstall: true
    };
  }

  // Si es iOS en modo inicio pero no tiene APIs, requiere actualizar iOS
  if (isIOS && isStandalone && !hasNativePush) {
    return {
      supported: false,
      permission: 'unsupported',
      isSubscribed: false,
      isIOS: true,
      isStandalone: true,
      needsIOSInstall: false,
      unsupportedReason: 'Tu iPhone requiere iOS 16.4 o superior para Web Push. Por favor actualiza tu versión de iOS en Ajustes > General > Actualización de software.'
    };
  }

  const permission = (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'default';
  let isSubscribed = false;

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg && reg.pushManager) {
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
    isIOS,
    isStandalone,
    needsIOSInstall: false
  };
}

/**
 * Suscribe este dispositivo a notificaciones push
 */
export async function subscribeToPushNotifications() {
  const isIOS = isIOSDevice();
  const isStandalone = isStandalonePWA();

  if (isIOS && !isStandalone) {
    throw new Error('En iPhone/iPad debes añadir Remanente a tu pantalla de inicio primero (Compartir ⬆️ -> Añadir a la pantalla de inicio). Luego abre la app desde tu pantalla de inicio.');
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Tu navegador no tiene activas las notificaciones push. Asegúrate de tener iOS 16.4 o superior y abrir la app desde la pantalla de inicio.');
  }

  // 1. Solicitar permiso al usuario
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('El permiso de notificaciones fue denegado en tu dispositivo. Puedes activarlo en los Ajustes de tu iPhone.');
  }

  // 2. Asegurar registro del Service Worker
  await registerServiceWorker();
  const reg = await navigator.serviceWorker.ready;

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
