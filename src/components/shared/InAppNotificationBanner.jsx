import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Bell, Swords, X, ExternalLink, Flame } from 'lucide-react';
import { playNotificationSound } from '../../utils/notificationSound';

const InAppNotificationBanner = () => {
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Escuchar eventos push delegados desde el Service Worker
    const handlePushReceived = (e) => {
      const data = e.detail || {};
      showBanner({
        title: data.title || '🔔 Remanente Platform',
        message: data.body || 'Tienes una nueva notificación.',
        url: data.url || '/'
      });
    };

    // 2. Escuchar evento general de notificación in-app
    const handleCustomNotification = (e) => {
      const data = e.detail || {};
      showBanner({
        title: data.title || '🔔 Remanente Platform',
        message: data.message || data.body || 'Nueva actualización',
        url: data.link || data.url || '/'
      });
    };

    window.addEventListener('remanente-push-received', handlePushReceived);
    window.addEventListener('show-notification-banner', handleCustomNotification);

    return () => {
      window.removeEventListener('remanente-push-received', handlePushReceived);
      window.removeEventListener('show-notification-banner', handleCustomNotification);
    };
  }, []);

  const showBanner = (data) => {
    // Reproducir sonido cristalino y vibración
    playNotificationSound();
    setNotification(data);

    // Auto-ocultar después de 9 segundos
    const timer = setTimeout(() => {
      setNotification((curr) => (curr === data ? null : curr));
    }, 9000);

    return () => clearTimeout(timer);
  };

  if (!notification) return null;

  const isDuel = notification.title?.toLowerCase().includes('duelo') || 
                 notification.title?.toLowerCase().includes('reto') ||
                 notification.url?.includes('duels');

  const handleClick = () => {
    const target = notification.url || '/';
    setNotification(null);
    navigate(target);
  };

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-md z-[9999] animate-bounce-short">
      <div className="bg-gradient-to-r from-slate-900 via-primary-dark to-slate-900 text-white p-4 rounded-2xl shadow-2xl border-2 border-gold/70 flex items-start gap-3 backdrop-blur-md relative overflow-hidden">
        {/* Resplandor decorativo */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full blur-2xl pointer-events-none" />
        
        {/* Ícono animado */}
        <div className="w-11 h-11 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
          {isDuel ? (
            <Swords className="w-6 h-6 text-gold animate-pulse" />
          ) : (
            <Bell className="w-6 h-6 text-gold animate-bounce" />
          )}
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0 pr-6 cursor-pointer" onClick={handleClick}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider bg-gold/20 text-gold-light px-2 py-0.5 rounded-full border border-gold/30">
              {isDuel ? '⚔️ Duelo Bíblico' : '🔔 Notificación'}
            </span>
            <span className="text-[11px] text-gray-400">Ahora</span>
          </div>

          <h4 className="font-bold text-sm text-white mt-1 leading-snug truncate font-[Cinzel]">
            {notification.title}
          </h4>
          <p className="text-xs text-gray-200 mt-0.5 line-clamp-2 leading-relaxed">
            {notification.message}
          </p>

          <div className="mt-2.5 flex items-center gap-2 text-xs font-semibold text-gold-light hover:text-gold transition-colors">
            <span>Ver ahora</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Botón cerrar */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setNotification(null);
          }}
          className="absolute top-3 right-3 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          title="Cerrar notificación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default InAppNotificationBanner;
