// Service Worker para Remanente Platform - Web Push Notifications & PWA
const CACHE_NAME = 'remanente-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Escuchar evento PUSH desde el servidor
self.addEventListener('push', (event) => {
  let data = {
    title: '📖 Remanente Platform',
    body: 'Tienes una nueva notificación en la plataforma.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: '/'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'remanente-notification-' + Date.now(),
    renotify: true,
    data: {
      url: (data.data && data.data.url) || data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions)
  );
});

// Manejar click en la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una ventana abierta de Remanente, enfocarla y navegar
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Si no hay ventana abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
