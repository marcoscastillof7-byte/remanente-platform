import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Menu, User, LogOut, Shield, Bell, CheckCircle, Swords, Flame } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../utils/api';

const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (user) {
      const fetchNotifs = async () => {
        try {
          const data = await api.get('/notifications');
          setNotifications(data || []);
        } catch (err) {
          console.error("Error cargando notificaciones", err);
        }
      };
      fetchNotifs();
      
      const interval = setInterval(fetchNotifs, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all', {});
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {}
  };

  const markRead = async (id, link) => {
    try {
      await api.put(`/notifications/${id}/read`, {});
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setNotifOpen(false);
      if (link) navigate(link);
    } catch (err) {}
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <nav className="bg-[var(--color-primary)] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 mr-2 md:hidden">
              <Menu className="w-6 h-6 text-[var(--color-gold)]" />
            </button>
            <Link to="/" className="flex items-center">
              <span className="font-cinzel text-xl md:text-2xl text-[var(--color-gold)] font-bold">📖 Remanente</span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="hover:text-[var(--color-gold)] transition-colors">Inicio</Link>
            <Link to="/duels" className="hover:text-[var(--color-gold)] transition-colors flex items-center"><Swords className="w-4 h-4 mr-1"/> Duelos</Link>
            <Link to="/survival" className="hover:text-[var(--color-gold)] transition-colors flex items-center"><Flame className="w-4 h-4 mr-1"/> Supervivencia</Link>
            <Link to="/leaderboard" className="hover:text-[var(--color-gold)] transition-colors">Tabla de Honor</Link>
            {isAdmin && (
              <Link to="/admin" className="flex items-center text-[var(--color-gold-light)] hover:text-white transition-colors">
                <Shield className="w-4 h-4 mr-1" />
                Panel Admin
              </Link>
            )}
          </div>

          <div className="flex items-center space-x-4 relative">
            
            {/* Notificaciones */}
            <div className="relative">
              <button 
                onClick={() => { setNotifOpen(!notifOpen); setDropdownOpen(false); }}
                className="relative p-2 rounded-md hover:bg-[var(--color-primary-light)] transition-colors"
              >
                <Bell className="w-5 h-5 text-[var(--color-gold)]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount}
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
                className="flex items-center space-x-2 p-2 rounded-md hover:bg-[var(--color-primary-light)] transition-colors"
              >
                <User className="w-5 h-5 text-[var(--color-gold)]" />
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
          <Link to="/" className="block px-3 py-2 rounded-md text-base hover:bg-[var(--color-primary-light)] text-white">Inicio</Link>
          <Link to="/duels" className="block px-3 py-2 rounded-md text-base hover:bg-[var(--color-primary-light)] text-white flex items-center"><Swords className="w-4 h-4 mr-2"/> Duelos Bíblicos</Link>
          <Link to="/survival" className="block px-3 py-2 rounded-md text-base hover:bg-[var(--color-primary-light)] text-white flex items-center"><Flame className="w-4 h-4 mr-2"/> Supervivencia</Link>
          <Link to="/leaderboard" className="block px-3 py-2 rounded-md text-base hover:bg-[var(--color-primary-light)] text-white">Tabla de Honor</Link>
          {isAdmin && (
            <Link to="/admin" className="block px-3 py-2 rounded-md text-base text-[var(--color-gold)] hover:bg-[var(--color-primary-light)]">Panel Admin</Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
