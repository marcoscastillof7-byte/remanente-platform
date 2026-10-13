import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { io } from 'socket.io-client';
import { 
  Users, 
  Plus, 
  Radio, 
  Calendar, 
  BookOpen, 
  Clock, 
  Play, 
  Trash2, 
  FileText, 
  CheckCircle,
  HelpCircle,
  Loader,
  ArrowRight,
  ShieldCheck,
  Award,
  XCircle
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import CreateMeetModal from '../components/meet/CreateMeetModal';

const MeetListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meets, setMeets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [startingId, setStartingId] = useState(null);
  const [onlineCount, setOnlineCount] = useState(1);

  const isLeaderOrAdmin = user && ['admin', 'superadmin', 'lider', 'leader'].includes(user.role?.toLowerCase());

  useEffect(() => {
    fetchMeets(true);

    const fetchOnline = async () => {
      try {
        const res = await api.get('/stats/online');
        if (res && typeof res.onlineCount === 'number') {
          setOnlineCount(Math.max(1, res.onlineCount));
        }
      } catch (e) {}
    };
    fetchOnline();

    const socketUrl = window.location.port === '5173' ? 'http://localhost:3001' : window.location.origin;
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    const handleRealtimeUpdate = () => {
      fetchMeets(false);
    };

    const handleOnlineStats = (data) => {
      if (data && typeof data.onlineCount === 'number') {
        setOnlineCount(Math.max(1, data.onlineCount));
      }
    };

    socket.on('meet:updated', handleRealtimeUpdate);
    socket.on('meet:started', handleRealtimeUpdate);
    socket.on('meet:session-ended', handleRealtimeUpdate);
    socket.on('meet:phase-changed', handleRealtimeUpdate);
    socket.on('platform:online-stats', handleOnlineStats);

    const handleOnlineWindow = (e) => {
      if (e.detail && typeof e.detail.onlineCount === 'number') {
        setOnlineCount(Math.max(1, e.detail.onlineCount));
      }
    };
    window.addEventListener('platform-online-update', handleOnlineWindow);

    const interval = setInterval(() => {
      fetchMeets(false);
      fetchOnline();
    }, 15000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('platform-online-update', handleOnlineWindow);
      socket.off('meet:updated', handleRealtimeUpdate);
      socket.off('meet:started', handleRealtimeUpdate);
      socket.off('meet:session-ended', handleRealtimeUpdate);
      socket.off('meet:phase-changed', handleRealtimeUpdate);
      socket.off('platform:online-stats', handleOnlineStats);
      socket.disconnect();
    };
  }, []);

  const fetchMeets = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const data = await api.get('/meetings', false);
      setMeets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando meets:', err);
      setMeets([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleStartMeet = async (meetId) => {
    if (!confirm('¿Deseas iniciar este Meet en vivo ahora? Se enviará una notificación a todos los miembros.')) return;
    setStartingId(meetId);
    try {
      await api.post(`/meetings/${meetId}/start`, {});
      navigate(`/meet/${meetId}`);
    } catch (err) {
      console.error(err);
      alert('Error iniciando el Meet. Intenta de nuevo.');
    } finally {
      setStartingId(null);
    }
  };

  const handleDeleteMeet = async (meetId) => {
    if (!confirm('¿Estás seguro de eliminar este Meet?')) return;
    try {
      await api.del(`/meetings/${meetId}`);
      setMeets(prev => (Array.isArray(prev) ? prev.filter(m => m.id !== meetId) : []));
    } catch (err) {
      console.error(err);
      alert('Error al eliminar Meet.');
    }
  };

  const handleEndMeet = async (meetId) => {
    if (!confirm('¿Deseas finalizar y cerrar esta reunión en vivo para todos los miembros?')) return;
    try {
      await api.put(`/meetings/${meetId}/status`, { status: 'ended' });
      await fetchMeets(false);
    } catch (err) {
      console.error(err);
      alert('Error cerrando el Meet.');
    }
  };

  const handleCloseAllMeets = async () => {
    if (!confirm('¿Estás seguro de cerrar TODAS las reuniones activas y programadas? Pasarán al historial de finalizadas.')) return;
    try {
      await api.post('/meetings/close-all', {});
      await fetchMeets(false);
      alert('Todas las reuniones han sido finalizadas con éxito.');
    } catch (err) {
      console.error(err);
      alert('Error cerrando todas las reuniones.');
    }
  };

  const meetsList = Array.isArray(meets) ? meets : [];
  const liveMeets = meetsList.filter(m => m.status === 'live');
  const scheduledMeets = meetsList.filter(m => m.status === 'scheduled');
  const pastMeets = meetsList.filter(m => m.status === 'ended');

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-primary-dark via-primary to-primary-dark text-white p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-xl border border-gold/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
        
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 bg-gold/20 text-gold-light border border-gold/30 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold animate-pulse" />
              <span>Estudio en Vivo & Quiz Interactivo</span>
            </div>
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{onlineCount} {onlineCount === 1 ? 'persona en línea' : 'personas en línea'}</span>
            </div>
          </div>
          <h1 className="font-[Cinzel] text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-wide">
            📖 Remanente Meet
          </h1>
        </div>

        {isLeaderOrAdmin && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm shadow-lg hover:shadow-gold/20 transition-all transform hover:-translate-y-0.5 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Crear Nuevo Meet</span>
            </button>

            {(liveMeets.length > 0 || scheduledMeets.length > 0) && (
              <button
                onClick={handleCloseAllMeets}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-red-600/80 hover:bg-red-600 text-white px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer hover:scale-105"
                title="Cerrar todas las reuniones activas y pasarlas al historial"
              >
                <XCircle className="w-4 h-4" />
                <span>Cerrar Todas</span>
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 gap-3 text-gray-500">
          <Loader className="w-8 h-8 animate-spin text-gold" />
          <p className="text-sm">Cargando salas de estudio...</p>
        </div>
      ) : (
        <>
          {/* SECCIÓN 1: MEETS EN VIVO (MÁXIMA PRIORIDAD) */}
          {liveMeets.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-[Cinzel] text-primary flex items-center gap-2">
                <span className="flex h-3.5 w-3.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600"></span>
                </span>
                <span>En Vivo Ahora Mismo</span>
              </h2>

              <div className="grid grid-cols-1 gap-4">
                {liveMeets.map(meet => (
                  <div 
                    key={meet.id}
                    className="bg-white rounded-xl sm:rounded-2xl shadow-xl border-2 border-red-500/80 p-4 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 relative overflow-hidden group hover:shadow-2xl transition-all"
                  >
                    <div className="space-y-2 flex-1 w-full">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="inline-flex items-center gap-1 bg-red-600 text-white px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-black tracking-wider uppercase shadow-xs animate-pulse">
                          🔴 En Vivo
                        </span>
                        {meet.bookName && (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-primary border border-blue-200 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold">
                            <BookOpen className="w-3.5 h-3.5" />
                            {meet.bookName}
                          </span>
                        )}
                        {meet.questionsCount > 0 && (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold">
                            <Award className="w-3.5 h-3.5 text-gold" />
                            {meet.questionsCount} Preguntas
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl sm:text-2xl font-bold font-[Cinzel] text-primary-dark group-hover:text-gold-dark transition-colors">
                        {meet.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">
                        {meet.descriptionText || 'Estudio interactivo de la Palabra en vivo.'}
                      </p>

                      <div className="text-xs text-gray-500 flex items-center gap-2 pt-1">
                        <span>Líder anfitrión: <strong className="text-primary">{meet.host_name}</strong></span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full md:w-auto shrink-0">
                      <button
                        onClick={() => navigate(`/meet/${meet.id}`)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-5 sm:px-7 py-3 sm:py-3.5 rounded-xl font-black text-xs sm:text-sm md:text-base shadow-lg shadow-red-600/30 hover:scale-102 sm:hover:scale-105 transition-all shrink-0 cursor-pointer text-center"
                      >
                        <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                        <span>Conectar y Entrar al Room 📖</span>
                      </button>

                      {isLeaderOrAdmin && (
                        <button
                          onClick={() => handleEndMeet(meet.id)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 px-4 py-2.5 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer text-center"
                          title="Finalizar y cerrar esta sesión en vivo para todos los miembros"
                        >
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span>Cerrar Meet</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECCIÓN 2: MEETS PROGRAMADOS */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold font-[Cinzel] text-primary flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gold" />
              <span>Próximos Meets Programados</span>
            </h2>

            {scheduledMeets.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center space-y-2">
                <Users className="w-12 h-12 text-gray-400 mx-auto" />
                <h4 className="font-bold text-gray-700 text-base">No hay Meets programados actualmente</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  {isLeaderOrAdmin 
                    ? 'Puedes crear un nuevo Meet usando el botón superior para convocar a la congregación.' 
                    : 'Pronto tu líder programará una nueva sesión de estudio. ¡Permanece atento a las notificaciones!'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scheduledMeets.map(meet => (
                  <div key={meet.id} className="bg-white rounded-xl shadow-md border border-gray-200 p-5 flex flex-col justify-between gap-4 hover:border-gold/50 transition-all">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                          Programado
                        </span>
                        {isLeaderOrAdmin && (
                          <button
                            onClick={() => handleDeleteMeet(meet.id)}
                            className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                            title="Eliminar Meet"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <h3 className="font-bold text-lg text-primary font-[Cinzel] line-clamp-1">
                        {meet.title}
                      </h3>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {meet.descriptionText || 'Sin descripción.'}
                      </p>

                      <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-100">
                        {meet.bookName && (
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-gold" />
                            <span>Libro: <strong>{meet.bookName}</strong></span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>Fecha: {new Date(meet.scheduled_for).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
                          <span>Anfitrión: {meet.host_name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                      {isLeaderOrAdmin ? (
                        <button
                          disabled={startingId === meet.id}
                          onClick={() => handleStartMeet(meet.id)}
                          className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white px-4 py-2.5 rounded-lg font-bold text-xs shadow-md transition-all disabled:opacity-50"
                        >
                          {startingId === meet.id ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4 fill-current" />
                          )}
                          <span>Iniciar en Vivo Ahora 🚀</span>
                        </button>
                      ) : (
                        <div className="text-xs text-gray-500 italic py-1 text-center w-full">
                          La sala se activará cuando el líder inicie la sesión
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECCIÓN 3: MEETS FINALIZADOS */}
          {pastMeets.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h2 className="text-lg font-bold font-[Cinzel] text-gray-700">
                Historial de Meets Finalizados ({pastMeets.length})
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {pastMeets.slice(0, 6).map(meet => (
                  <div key={meet.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-xs space-y-1.5">
                    <div className="flex justify-between items-center text-gray-400">
                      <span>{new Date(meet.scheduled_for).toLocaleDateString()}</span>
                      <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">Finalizado</span>
                    </div>
                    <h4 className="font-bold text-gray-800 text-sm truncate font-[Cinzel]">{meet.title}</h4>
                    <p className="text-gray-500 truncate">{meet.bookName || 'Estudio general'}</p>
                    <p className="text-[11px] text-gray-400">Anfitrión: {meet.host_name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de Creación */}
      <CreateMeetModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(newMeet, startedNow) => {
          fetchMeets();
          if (startedNow && newMeet?.id) {
            navigate(`/meet/${newMeet.id}`);
          }
        }}
      />

    </div>
  );
};

export default MeetListPage;
