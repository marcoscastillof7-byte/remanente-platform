import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../utils/supabase';

const GlobalRealtimeManager = () => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const presenceChannelRef = useRef(null);
  const knownOnlineUsersRef = useRef(new Map()); // id -> user object

  useEffect(() => {
    const currentUserId = user?.id ? String(user.id) : null;
    const currentUsername = user?.username || 'Invitado en línea';
    const currentRole = user?.role || 'user';
    const currentPoints = user?.points || 0;

    // Helper para emitir el conteo unificado sin fluctuaciones
    const emitUnifiedOnlineStats = (source = 'realtime') => {
      const usersList = Array.from(knownOnlineUsersRef.current.values());
      const onlineCount = Math.max(1, usersList.length);

      window.dispatchEvent(new CustomEvent('platform-online-update', {
        detail: {
          onlineCount,
          users: usersList,
          timestamp: Date.now(),
          source
        }
      }));
    };

    // ==========================================
    // 1. SUPABASE REALTIME PRESENCE (PRESENCIA GLOBAL UNIVERSAL)
    // ==========================================
    const presenceKey = currentUserId 
      ? `user_${currentUserId}` 
      : `anon_${Math.random().toString(36).substring(2, 9)}`;

    const presenceChannel = supabase.channel('remanente_platform_presence', {
      config: {
        presence: {
          key: presenceKey,
        },
      },
    });

    presenceChannelRef.current = presenceChannel;

    const trackPresence = async () => {
      try {
        if (!presenceChannel) return;
        await presenceChannel.track({
          id: currentUserId || `guest_${presenceKey}`,
          userId: currentUserId,
          username: currentUsername,
          role: currentRole,
          points: currentPoints,
          isGuest: !currentUserId,
          onlineAt: new Date().toISOString()
        });
      } catch (trackErr) {
        // Silencioso
      }
    };

    const handlePresenceSync = () => {
      try {
        const state = presenceChannel.presenceState();
        const activeNow = new Map();

        for (const key of Object.keys(state)) {
          const presences = state[key] || [];
          for (const p of presences) {
            if (!p) continue;
            const uId = String(p.id || p.userId || p.username || key);
            activeNow.set(uId, {
              id: uId,
              userId: p.userId,
              username: p.username || (p.isGuest ? 'Invitado en línea' : 'Hermano en línea'),
              role: p.role || 'user',
              points: p.points || 0,
              isGuest: Boolean(p.isGuest),
              onlineAt: p.onlineAt || new Date().toISOString()
            });
          }
        }

        // Siempre asegurar que el usuario actual esté presente en el mapa
        const myId = currentUserId || `guest_${presenceKey}`;
        if (!activeNow.has(myId)) {
          activeNow.set(myId, {
            id: myId,
            userId: currentUserId,
            username: currentUsername,
            role: currentRole,
            points: currentPoints,
            isGuest: !currentUserId,
            onlineAt: new Date().toISOString()
          });
        }

        // Actualizar el registro maestro de presencia
        knownOnlineUsersRef.current = activeNow;
        emitUnifiedOnlineStats('supabase-presence');
      } catch (err) {
        console.error('Error procesando sincronización de presencia:', err);
      }
    };

    presenceChannel
      .on('presence', { event: 'sync' }, handlePresenceSync)
      .on('presence', { event: 'join' }, handlePresenceSync)
      .on('presence', { event: 'leave' }, handlePresenceSync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await trackPresence();
        }
      });

    // ==========================================
    // 2. ACTUALIZACIÓN PERIÓDICA DE ACTIVIDAD EN BD (last_active)
    // ==========================================
    let lastActiveInterval = null;
    const touchLastActive = async () => {
      if (!user?.id) return;
      try {
        await supabase
          .from('users')
          .update({ last_active: new Date().toISOString() })
          .eq('id', user.id);
      } catch (e) {
        // Silencioso
      }
    };

    if (user?.id) {
      touchLastActive();
      lastActiveInterval = setInterval(touchLastActive, 45000); // Cada 45 segundos
    }

    // ==========================================
    // 3. LISTENERS DE VISIBILIDAD, RED Y ENFOQUE (ANTI-SLEEP MÓVIL)
    // ==========================================
    const handleRecheck = () => {
      trackPresence();
      if (user?.id) touchLastActive();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRecheck();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleRecheck);
    window.addEventListener('focus', handleRecheck);

    // Heartbeat de presencia cada 25 segundos para renovar arrendamiento en Supabase
    const presenceHeartbeat = setInterval(() => {
      trackPresence();
    }, 25000);

    // ==========================================
    // 4. SOCKET.IO (TIEMPO REAL DE WEBSOCKETS EN SERVIDOR)
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

    // Ping periódico al socket
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('platform:ping');
      }
    }, 15000);

    // Manejador unificado de estadísticas provenientes del socket
    const handleSocketOnlineData = (data) => {
      if (!data) return;
      
      // Si el socket trae usuarios, fusionarlos sin borrar los ya confirmados en presencia
      if (Array.isArray(data.users) && data.users.length > 0) {
        data.users.forEach(u => {
          if (u && (u.id || u.username)) {
            const uId = String(u.id || u.username);
            if (!knownOnlineUsersRef.current.has(uId)) {
              knownOnlineUsersRef.current.set(uId, {
                id: uId,
                username: u.username,
                role: u.role || 'user',
                points: u.points || 0,
                onlineAt: new Date().toISOString()
              });
            }
          }
        });
      }

      emitUnifiedOnlineStats('socket');
    };

    socket.on('platform:online-stats', handleSocketOnlineData);
    socket.on('platform:pong', handleSocketOnlineData);

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
    // 5. SUSCRIPCIÓN GLOBAL A CAMBIOS DE TABLAS EN SUPABASE
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
      clearInterval(presenceHeartbeat);
      if (lastActiveInterval) clearInterval(lastActiveInterval);

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleRecheck);
      window.removeEventListener('focus', handleRecheck);
      
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
