import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../utils/supabase';

const GlobalRealtimeManager = () => {
  const { user } = useAuth();

  useEffect(() => {
    const socketUrl = window.location.port === '5173' 
      ? `${window.location.protocol}//${window.location.hostname}:3001` 
      : window.location.origin;

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000
    });

    // 1. Identificar al usuario en la plataforma
    const identify = () => {
      if (user && (user.id || user.username)) {
        socket.emit('platform:identify', {
          id: user.id,
          username: user.username,
          role: user.role
        });
      }
    };

    socket.on('connect', identify);
    identify();

    // 2. Ping periódico para certificar presencia activa
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('platform:ping');
      }
    }, 20000);

    // 3. Estadísticas de conectados en plataforma
    socket.on('platform:online-stats', (data) => {
      window.dispatchEvent(new CustomEvent('platform-online-update', { detail: data }));
    });

    socket.on('platform:pong', (data) => {
      window.dispatchEvent(new CustomEvent('platform-online-update', { detail: data }));
    });

    // 4. Notificaciones de reuniones en vivo iniciadas
    socket.on('meet:started', (data) => {
      window.dispatchEvent(new CustomEvent('show-notification-banner', {
        detail: {
          title: '📖 ¡Estudio Bíblico en Vivo!',
          message: `${data.title || 'Una reunión'} acaba de comenzar. ¡Toca aquí para unirte!`,
          url: `/meet/${data.meetId}`
        }
      }));
      window.dispatchEvent(new CustomEvent('remanente-meet-updated', { detail: data }));
    });

    // 5. Actualización de Meets y Leaderboard
    socket.on('meet:updated', (data) => {
      window.dispatchEvent(new CustomEvent('remanente-meet-updated', { detail: data }));
    });

    socket.on('meet:session-ended', (data) => {
      window.dispatchEvent(new CustomEvent('remanente-meet-updated', { detail: data }));
    });

    socket.on('leaderboard-update', (data) => {
      window.dispatchEvent(new CustomEvent('remanente-leaderboard-update', { detail: data }));
    });

    // 6. Suscripción global a Supabase Realtime
    const globalChannel = supabase
      .channel('global_platform_realtime_hub')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetings' },
        (payload) => {
          window.dispatchEvent(new CustomEvent('remanente-meet-updated', { detail: payload }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        (payload) => {
          window.dispatchEvent(new CustomEvent('remanente-leaderboard-update', { detail: payload }));
        }
      )
      .subscribe();

    return () => {
      clearInterval(pingInterval);
      supabase.removeChannel(globalChannel);
      socket.disconnect();
    };
  }, [user]);

  return null;
};

export default GlobalRealtimeManager;
