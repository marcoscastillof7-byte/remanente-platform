import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../utils/supabase';

const GlobalRealtimeManager = () => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const presenceChannelRef = useRef(null);

  useEffect(() => {
    // Si no hay usuario, permitimos presencia anónima o salimos
    const currentUserId = user?.id ? String(user.id) : null;
    const currentUsername = user?.username || 'Invitado';
    const currentRole = user?.role || 'user';
    const currentPoints = user?.points || 0;

    // ==========================================
    // 1. SUPABASE REALTIME PRESENCE (PRESENCIA GLOBAL)
    // ==========================================
    const presenceKey = currentUserId ? `user_${currentUserId}` : `anon_${Math.random().toString(36).substring(2, 9)}`;
    const presenceChannel = supabase.channel('remanente_platform_presence', {
      config: {
        presence: {
          key: presenceKey,
        },
      },
    });

    presenceChannelRef.current = presenceChannel;

    const handlePresenceSync = () => {
      try {
        const state = presenceChannel.presenceState();
        const usersList = [];
        const seenIds = new Set();

        for (const key of Object.keys(state)) {
          const presences = state[key] || [];
          for (const p of presences) {
            if (p && p.id) {
              const idStr = String(p.id);
              if (!seenIds.has(idStr)) {
                seenIds.add(idStr);
                usersList.push({
                  id: p.id,
                  username: p.username,
                  role: p.role || 'user',
                  points: p.points || 0,
                  onlineAt: p.onlineAt || new Date().toISOString()
                });
              }
            } else if (p && p.username) {
              usersList.push({
                id: `anon_${Math.random()}`,
                username: p.username,
                role: 'user',
                points: 0,
                onlineAt: new Date().toISOString()
              });
            }
          }
        }

        const onlineCount = Math.max(1, usersList.length);

        window.dispatchEvent(new CustomEvent('platform-online-update', {
          detail: {
            onlineCount,
            users: usersList,
            timestamp: Date.now(),
            source: 'supabase-presence'
          }
        }));
      } catch (err) {
        console.error('Error procesando sincronización de presencia:', err);
      }
    };

    presenceChannel
      .on('presence', { event: 'sync' }, handlePresenceSync)
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        handlePresenceSync();
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        handlePresenceSync();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user && user.id) {
          try {
            await presenceChannel.track({
              id: user.id,
              username: user.username,
              role: user.role || 'user',
              points: user.points || 0,
              onlineAt: new Date().toISOString()
            });
          } catch (trackErr) {
            console.error('Error registrando presencia en Supabase:', trackErr);
          }
        }
      });

    // ==========================================
    // 2. ACTUALIZACIÓN PERIÓDICA DE ACTIVIDAD (last_active)
    // ==========================================
    let lastActiveInterval = null;
    if (user && user.id) {
      const touchLastActive = async () => {
        try {
          await supabase
            .from('users')
            .update({ last_active: new Date().toISOString() })
            .eq('id', user.id);
        } catch (e) {
          // Silencioso
        }
      };

      touchLastActive();
      lastActiveInterval = setInterval(touchLastActive, 60000); // Cada 60 segundos
    }

    // ==========================================
    // 3. SOCKET.IO (TIEMPO REAL DE WEBSOCKETS)
    // ==========================================
    const socketUrl = window.location.port === '5173' 
      ? `${window.location.protocol}//${window.location.hostname}:3001` 
      : window.location.origin;

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    const identify = () => {
      if (user && (user.id || user.username)) {
        socket.emit('platform:identify', {
          id: user.id,
          username: user.username,
          role: user.role,
          points: user.points || 0
        });
      }
    };

    socket.on('connect', identify);
    socket.on('reconnect', identify);
    identify();

    // Ping periódico de presencia activa
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('platform:ping');
      }
    }, 15000);

    // Eventos de presencia del socket
    socket.on('platform:online-stats', (data) => {
      if (data && typeof data.onlineCount === 'number') {
        window.dispatchEvent(new CustomEvent('platform-online-update', { 
          detail: {
            onlineCount: data.onlineCount,
            users: data.users || [],
            source: 'socket'
          }
        }));
      }
    });

    socket.on('platform:pong', (data) => {
      if (data && typeof data.onlineCount === 'number') {
        window.dispatchEvent(new CustomEvent('platform-online-update', { 
          detail: {
            onlineCount: data.onlineCount,
            users: data.users || [],
            source: 'socket'
          }
        }));
      }
    });

    // Notificaciones de reuniones en vivo iniciadas
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

    // Actualización de Meets y Leaderboard
    socket.on('meet:updated', (data) => {
      window.dispatchEvent(new CustomEvent('remanente-meet-updated', { detail: data }));
    });

    socket.on('meet:session-ended', (data) => {
      window.dispatchEvent(new CustomEvent('remanente-meet-updated', { detail: data }));
    });

    socket.on('leaderboard-update', (data) => {
      window.dispatchEvent(new CustomEvent('remanente-leaderboard-update', { detail: data }));
    });

    // ==========================================
    // 4. SUSCRIPCIÓN GLOBAL A CAMBIOS DE TABLAS EN SUPABASE
    // ==========================================
    const dbChangesChannel = supabase
      .channel('global_platform_db_changes')
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
      if (lastActiveInterval) clearInterval(lastActiveInterval);
      
      try {
        if (presenceChannel) {
          presenceChannel.untrack();
          supabase.removeChannel(presenceChannel);
        }
        if (dbChangesChannel) {
          supabase.removeChannel(dbChangesChannel);
        }
      } catch (cleanErr) {}

      if (socket) {
        socket.disconnect();
      }
    };
  }, [user]);

  return null;
};

export default GlobalRealtimeManager;
