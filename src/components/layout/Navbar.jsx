import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { Menu, User, LogOut, Shield, Bell, CheckCircle, Swords, Flame, MessageSquare, Users, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../utils/api';
import { getRankInfo } from '../../utils/ranks';

const Navbar = () => {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [onlineUsersModalOpen, setOnlineUsersModalOpen] = useState(false);
  
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestionType, setSuggestionType] = useState('Sugerencia de Mejora');
  const [suggestionText, setSuggestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSuggestionSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/reports/general', {
        reason: suggestionType,
        details: suggestionText
      });
      alert('¡Sugerencia enviada! Muchas gracias por ayudarnos a mejorar.');
      setShowSuggestion(false);
      setSuggestionText('');
      setSuggestionType('Sugerencia de Mejora');
    } catch (err) {
      console.error(err);
      alert('Error al enviar sugerencia. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const knownNotifIdsRef = useRef(new Set());
  const initialLoadedRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    const fetchNotifs = async () => {
      try {
        const data = await api.get('/notifications');
        const notifList = data || [];

        // Detectar si llegaron notificaciones nuevas no leídas desde la última comprobación
        if (initialLoadedRef.current) {
          const newUnread = notifList.filter(n => !n.is_read && !knownNotifIdsRef.current.has(n.id));
          if (newUnread.length > 0) {
            // Tomar la notificación más reciente y lanzar el banner flotante con sonido
            const newest = newUnread[0];
            window.dispatchEvent(
              new CustomEvent('show-notification-banner', {
                detail: {
                  title: newest.title,
                  message: newest.message,
                  link: newest.link
                }
              })
            );
          }
        }

        // Registrar IDs conocidos
        knownNotifIdsRef.current = new Set(notifList.map(n => n.id));
        initialLoadedRef.current = true;
        setNotifications(notifList);
      } catch (err) {
        console.error("Error cargando notificaciones", err);
      }
    };

    fetchNotifs();

    // Comprobación rápida cada 12 segundos para que las alertas lleguen al instante
    const interval = setInterval(fetchNotifs, 12000);

    // Comprobar de inmediato al volver a enfocar la ventana o cambiar pestaña
    const handleFocus = () => fetchNotifs();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchNotifs();
    };
    const handlePushReceived = () => fetchNotifs();

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('remanente-push-received', handlePushReceived);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('remanente-push-received', handlePushReceived);
    };
  }, [user]);

  // Seguimiento y sincronización en tiempo real de personas conectadas a la plataforma
  useEffect(() => {
    if (!user) return;

    const fetchOnlineCount = async () => {
      try {
        const res = await api.get('/stats/online');
        if (res) {
          if (typeof res.onlineCount === 'number') {
            setOnlineCount(prev => Math.max(1, res.onlineCount, prev));
          }
          if (Array.isArray(res.users) && res.users.length > 0) {
            setOnlineUsers(prev => {
              const map = new Map();
              (prev || []).forEach(u => u && u.id && map.set(String(u.id), u));
              res.users.forEach(u => u && u.id && map.set(String(u.id), u));
              return Array.from(map.values());
            });
          }
        }
      } catch (err) {}
    };

    fetchOnlineCount();

    const handleOnlineUpdate = (e) => {
      if (e?.detail) {
        if (typeof e.detail.onlineCount === 'number') {
          setOnlineCount(Math.max(1, e.detail.onlineCount));
        }
        if (Array.isArray(e.detail.users) && e.detail.users.length > 0) {
          setOnlineUsers(e.detail.users);
        }
      }
    };

    window.addEventListener('platform-online-update', handleOnlineUpdate);
    const interval = setInterval(fetchOnlineCount, 25000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('platform-online-update', handleOnlineUpdate);
    };
  }, [user]);

  const roleLower = (user?.role || '').toLowerCase();
  const isLeaderOrAdmin = Boolean(
    isAdmin ||
    isSuperAdmin ||
    ['admin', 'superadmin', 'lider', 'leader'].includes(roleLower) ||
    user?.username?.toLowerCase() === 'marcos'
  );

  // Lista autoritativa de usuarios conectados (acceso exclusivo para líderes y administradores)
  const effectiveOnlineUsers = useMemo(() => {
    if (!isLeaderOrAdmin) return [];
    const list = [...(onlineUsers || [])];
    if (user?.id && !list.some(u => String(u.id) === String(user.id))) {
      list.unshift({
        id: user.id,
        username: user.username,
        role: user.role,
        points: user.points || 0,
        onlineAt: new Date().toISOString()
      });
    }
    return list;
  }, [onlineUsers, user, isLeaderOrAdmin]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all', {});
      setNotifications([]);
    } catch (err) {}
  };

  const markRead = async (id, link) => {
    try {
      await api.put(`/notifications/${id}/read`, {});
      setNotifications(prev => prev.filter(n => n.id !== id));
      setNotifOpen(false);
      if (link) navigate(link);
    } catch (err) {}
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const hasPendingDuel = notifications.some(n => !n.is_read && n.title === '¡Nuevo Reto!');

  return (
    <nav className="bg-[var(--color-primary)] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 mr-2 md:hidden">
              <Menu className="w-6 h-6 text-[var(--color-gold)]" />
            </button>
            <Link to="/" className="flex items-center min-w-0">
              <span className="font-[Cinzel] text-lg sm:text-xl md:text-2xl text-[var(--color-gold)] font-bold truncate max-w-[150px] xs:max-w-[220px] sm:max-w-xs md:max-w-none">
                📖 {user?.groups?.name || 'Olimpiadas GVY'}
              </span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="hover:text-[var(--color-gold)] transition-colors">Inicio</Link>
            <Link to="/duels" className="hover:text-[var(--color-gold)] transition-colors flex items-center relative">
              <Swords className="w-4 h-4 mr-1"/> Duelos
              {hasPendingDuel && (
                <span className="absolute -top-1 -right-2 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 border-2 border-[var(--color-primary)]"></span>
              )}
            </Link>
            <Link to="/survival" className="hover:text-[var(--color-gold)] transition-colors flex items-center"><Flame className="w-4 h-4 mr-1"/> Supervivencia</Link>

            <Link to="/leaderboard" className="hover:text-[var(--color-gold)] transition-colors">Tabla de Honor</Link>
            <button onClick={() => setShowSuggestion(true)} className="hover:text-[var(--color-gold)] transition-colors flex items-center">
              <MessageSquare className="w-4 h-4 mr-1"/> Sugerencias
            </button>
            {isAdmin && (
              <Link to="/admin" className="flex items-center text-[var(--color-gold-light)] hover:text-white transition-colors font-medium">
                <Shield className="w-4 h-4 mr-1 text-[var(--color-gold)]" />
                Panel Admin
              </Link>
            )}
            {isSuperAdmin && (
              <Link to="/superadmin" className="flex items-center text-red-400 font-bold hover:text-red-300 transition-colors bg-white/10 px-2 py-1 rounded">
                <Shield className="w-4 h-4 mr-1" />
                Súper Panel
              </Link>
            )}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 relative">
            
            {/* Contador de Personas Conectadas en Tiempo Real (Clic habilitado únicamente para Líderes y Admin) */}
            {isLeaderOrAdmin ? (
              <button 
                type="button"
                onClick={() => setOnlineUsersModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/20 transition-all rounded-full text-xs text-gray-200 border border-emerald-500/30 hover:border-emerald-400 shadow-sm shrink-0 cursor-pointer group"
                title={`${onlineCount} ${onlineCount === 1 ? 'persona conectada' : 'personas conectadas'} en tiempo real. Clic para ver quiénes están en línea (Solo Líderes/Admin).`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <span className="font-extrabold text-emerald-300">{onlineCount}</span>
                <span className="hidden sm:inline text-gray-300 font-medium group-hover:text-white">en línea</span>
              </button>
            ) : (
              <div 
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-full text-xs text-gray-200 border border-emerald-500/30 shadow-sm shrink-0 cursor-default select-none"
                title={`${onlineCount} ${onlineCount === 1 ? 'persona conectada' : 'personas conectadas'} en la plataforma`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <span className="font-extrabold text-emerald-300">{onlineCount}</span>
                <span className="hidden sm:inline text-gray-300 font-medium">en línea</span>
              </div>
            )}

            {/* Notificaciones */}
            <div className="relative">
              <button 
                onClick={() => { setNotifOpen(!notifOpen); setDropdownOpen(false); }}
                className="relative p-2 rounded-md hover:bg-[var(--color-primary-light)] transition-colors"
                title={unreadCount > 0 ? `Tienes ${unreadCount} notificaciones sin leer` : 'Notificaciones'}
              >
                <Bell className={`w-5 h-5 text-[var(--color-gold)] transition-transform ${unreadCount > 0 ? 'animate-bounce' : ''}`} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-md">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative">{unreadCount}</span>
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-1 w-80 max-w-[90vw] bg-white text-gray-800 rounded-lg shadow-xl border z-50 overflow-hidden">
                  <div className="flex justify-between items-center p-3 border-b bg-gray-50">
                    <h3 className="font-bold text-sm text-[var(--color-primary)]">Notificaciones</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1" /> Marcar leídas
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-gray-500 p-4 text-center">No tienes notificaciones.</p>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => markRead(n.id, n.link)}
                          className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50' : ''}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-sm font-bold ${!n.is_read ? 'text-[var(--color-primary)]' : 'text-gray-600'}`}>{n.title}</span>
                            {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>}
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">{n.message}</p>
                          <span className="text-[10px] text-gray-400 mt-1 block">
                            {new Date(n.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button 
                onClick={() => { setDropdownOpen(!dropdownOpen); setNotifOpen(false); }}
                className="flex items-center space-x-1 sm:space-x-2 p-1 sm:p-2 rounded-md hover:bg-[var(--color-primary-light)] transition-colors"
              >
                <div className="flex flex-col items-end mr-1">
                  <span className="text-[11px] sm:text-xs text-[var(--color-gold)] font-bold whitespace-nowrap">
                    {user.points || 0} pts {getRankInfo(user.points).icon}
                  </span>
                </div>
                <User className="w-5 h-5 text-[var(--color-gold)] hidden sm:block" />
                <span className="hidden sm:block text-sm">{user.username}</span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white text-gray-800 rounded-md shadow-lg py-1 z-50">
                  <Link to="/profile" className="block px-4 py-2 text-sm hover:bg-gray-100" onClick={() => setDropdownOpen(false)}>Mi Perfil</Link>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center">
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {menuOpen && (
        <div className="md:hidden bg-[var(--color-primary-dark)] px-2 pt-2 pb-3 space-y-1">
          <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-md text-xs text-gray-300 mb-1 border border-white/10">
            <span className="text-gray-300 font-medium">Usuarios conectados:</span>
            <span className="flex items-center gap-1.5 font-bold text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {onlineCount} {onlineCount === 1 ? 'en línea' : 'en línea'}
            </span>
          </div>
          <Link to="/" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded-md text-base hover:bg-[var(--color-primary-light)] text-white">Inicio</Link>
          <Link to="/meet" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded-md text-base hover:bg-[var(--color-primary-light)] text-white flex items-center">
            <Users className="w-4 h-4 mr-2"/> Meet en Vivo
          </Link>
          <Link to="/duels" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded-md text-base hover:bg-[var(--color-primary-light)] text-white flex items-center justify-between">
            <div className="flex items-center"><Swords className="w-4 h-4 mr-2"/> Duelos Bíblicos</div>
            {hasPendingDuel && <span className="flex h-3 w-3 rounded-full bg-red-500"></span>}
          </Link>
          <Link to="/survival" className="block px-3 py-2 rounded-md text-base hover:bg-[var(--color-primary-light)] text-white flex items-center"><Flame className="w-4 h-4 mr-2"/> Supervivencia</Link>

          <Link to="/leaderboard" className="block px-3 py-2 rounded-md text-base hover:bg-[var(--color-primary-light)] text-white">Tabla de Honor</Link>
          <button onClick={() => { setShowSuggestion(true); setMenuOpen(false); }} className="w-full text-left block px-3 py-2 rounded-md text-base hover:bg-[var(--color-primary-light)] text-[var(--color-gold)] flex items-center">
            <MessageSquare className="w-4 h-4 mr-2"/> Sugerencias
          </button>
          {isAdmin && (
            <Link to="/admin" className="block px-3 py-2 rounded-md text-base text-[var(--color-gold)] hover:bg-[var(--color-primary-light)]">Panel Admin</Link>
          )}
          {isSuperAdmin && (
            <Link to="/superadmin" className="block px-3 py-2 rounded-md text-base font-bold text-red-400 bg-white/5 hover:bg-white/10">Súper Panel Admin</Link>
          )}

          <div className="px-3 py-2 flex items-center justify-between border-t border-white/10 mt-1 pt-2">
            <span className="text-xs text-gray-300">Conectados en vivo:</span>
            {isLeaderOrAdmin ? (
              <button
                onClick={() => { setOnlineUsersModalOpen(true); setMenuOpen(false); }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/20 transition-colors rounded-full text-xs text-emerald-300 font-bold cursor-pointer"
                title="Clic para ver quiénes están en línea (Solo Líderes/Admin)"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>{onlineCount} en línea</span>
              </button>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-full text-xs text-emerald-300 font-bold select-none"
                title={`${onlineCount} personas en línea`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{onlineCount} en línea</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sugerencias Modal */}
      {showSuggestion && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-gray-800">
            <h2 className="font-[Cinzel] text-xl font-bold text-primary mb-2">Buzón de Sugerencias</h2>
            <p className="text-sm text-gray-500 mb-4">Ayúdanos a mejorar. Si tienes una idea nueva o viste algo que no funciona bien, descríbelo aquí.</p>
            
            <form onSubmit={handleSuggestionSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Tipo</label>
                <select 
                  value={suggestionType} 
                  onChange={(e) => setSuggestionType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gold text-sm bg-white text-gray-800"
                >
                  <option value="Sugerencia de Mejora">Sugerencia de Mejora</option>
                  <option value="Reporte de Error / Bug">Reporte de Error / Bug</option>
                  <option value="Idea Nueva">Idea Nueva</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Detalles</label>
                <textarea
                  value={suggestionText}
                  onChange={(e) => setSuggestionText(e.target.value)}
                  className="w-full h-24 p-2 border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-gold text-sm bg-white text-gray-800"
                  placeholder="Explícanos tu idea o el problema que encontraste..."
                  required
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSuggestion(false)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !suggestionText.trim()}
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-light text-sm font-bold disabled:opacity-50"
                >
                  {submitting ? 'Enviando...' : 'Enviar Sugerencia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hermanos Conectados en Vivo (Exclusivo Líderes y Admin) */}
      {onlineUsersModalOpen && isLeaderOrAdmin && (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 flex flex-col max-h-[85vh]">
            
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-[var(--color-primary-dark)] to-[var(--color-primary)] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-emerald-400 border border-white/15">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-[Cinzel] font-bold text-lg text-white">
                    Conectados en Tiempo Real
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span className="font-bold">{onlineCount} {onlineCount === 1 ? 'hermano conectado' : 'hermanos conectados'} ahora</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOnlineUsersModalOpen(false)}
                className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista de Usuarios Conectados */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1 divide-y divide-gray-100">
              {effectiveOnlineUsers && effectiveOnlineUsers.length > 0 ? (
                effectiveOnlineUsers.map((u, i) => {
                  const rank = getRankInfo(u.points);
                  const isMe = String(u.id) === String(user.id);
                  return (
                    <div key={u.id || i} className="pt-3 first:pt-0 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-primary-light)] text-white font-bold flex items-center justify-center text-xs shadow-sm">
                            {(u.username || 'U').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-300" title="En línea"></span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-800 text-sm">{u.username}</span>
                            {isMe && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">Tú</span>
                            )}
                            {(u.role === 'admin' || u.role === 'superadmin') && (
                              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                                {u.role === 'superadmin' ? 'Superadmin' : 'Líder'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <span>{rank.icon}</span>
                            <span className={`font-medium ${rank.color}`}>{rank.name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          En línea
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <p className="font-medium text-gray-600">Estás conectado a la plataforma</p>
                  <p className="text-xs text-gray-400">Cuando otros hermanos abran la aplicación, los verás aparecer aquí en vivo.</p>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Sincronización en vivo activa
              </span>
              <button
                type="button"
                onClick={() => setOnlineUsersModalOpen(false)}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
