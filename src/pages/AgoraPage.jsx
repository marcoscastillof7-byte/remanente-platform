import React, { useState, useEffect, useContext } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { AuthContext } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { Calendar, Video, Users, Plus, Loader, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const AgoraPage = () => {
  const { user } = useContext(AuthContext);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState(null);
  const [showForm, setShowForm] = useState(false);
  
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState('');

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const data = await api.get('/meetings');
      setMeetings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createMeeting = async (e) => {
    e.preventDefault();
    try {
      await api.post('/meetings', {
        title: newTitle,
        description: newDesc,
        scheduled_for: newDate
      });
      setShowForm(false);
      fetchMeetings();
    } catch (err) {
      console.error(err);
      alert('Error al programar');
    }
  };

  const joinMeeting = (roomName) => {
    setActiveRoom(roomName);
  };

  const leaveMeeting = () => {
    setActiveRoom(null);
  };

  if (activeRoom) {
    return (
      <div className="flex flex-col h-full absolute inset-0 z-50 bg-white">
        <div className="flex justify-between items-center p-4 bg-[var(--color-primary)] text-white">
          <h1 className="text-xl font-bold font-serif">Ágora Bíblica - Sala en Vivo</h1>
          <button onClick={leaveMeeting} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            <LogOut className="w-4 h-4" />
            Salir de la Sala
          </button>
        </div>
        <div className="flex-1 w-full relative bg-gray-900">
          <JitsiMeeting
            domain="meet.jit.si"
            roomName={activeRoom}
            configOverwrite={{
              startWithAudioMuted: true,
              startWithVideoMuted: true,
              disableModeratorIndicator: true,
            }}
            interfaceConfigOverwrite={{
              DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            }}
            userInfo={{
              displayName: user?.username || 'Estudiante',
              email: user?.email || ''
            }}
            getIFrameRef={(iframeRef) => {
              iframeRef.style.height = '100%';
              iframeRef.style.width = '100%';
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto h-full pb-20">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-serif text-[var(--color-primary)] flex items-center gap-3">
            <Users className="w-8 h-8 text-[var(--color-gold)]" />
            El Ágora
          </h1>
          <p className="text-gray-600 mt-2">Salas de estudio, debate y koinonía en vivo.</p>
        </div>
        {user?.role === 'admin' && (
          <button onClick={() => setShowForm(!showForm)} className="bg-[var(--color-secondary)] hover:bg-[var(--color-gold)] text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-sm">
            <Plus className="w-5 h-5" />
            Programar Reunión
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={createMeeting} className="bg-white p-6 rounded-xl shadow-md border mb-8 animate-fade-in">
          <h3 className="font-bold text-lg mb-4 text-[var(--color-primary)]">Nueva Reunión</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
              <input type="text" required value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-gold)]" placeholder="Ej. Repaso: Reyes" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora</label>
              <input type="datetime-local" required value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-gold)]" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea required value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-gold)]" rows={2} placeholder="Temas a tratar..."></textarea>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-light)]">Programar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center p-12"><Loader className="w-8 h-8 animate-spin text-[var(--color-gold)]" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meetings.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No hay reuniones programadas actualmente.</p>
            </div>
          ) : (
            meetings.map(m => {
              const isLive = m.status === 'live' || new Date(m.scheduled_for) < new Date();
              
              return (
                <div key={m.id} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
                  {isLive && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse" />
                  )}
                  
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-xl text-[var(--color-primary)]">{m.title}</h3>
                    {isLive && (
                      <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 animate-pulse">
                        <span className="w-2 h-2 bg-red-600 rounded-full" />
                        EN VIVO
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-6 flex-grow">{m.description}</p>
                  
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4 bg-gray-50 p-2 rounded-lg">
                    <Calendar className="w-4 h-4 text-[var(--color-secondary)]" />
                    {format(new Date(m.scheduled_for), "EEEE d 'de' MMMM, h:mm a", { locale: es })}
                  </div>
                  
                  <button 
                    onClick={() => joinMeeting(m.room_name)}
                    className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                      isLive 
                        ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white shadow-md hover:shadow-lg' 
                        : 'bg-gray-100 text-gray-600 hover:bg-[var(--color-secondary)] hover:text-white'
                    }`}
                  >
                    <Video className="w-5 h-5" />
                    {isLive ? 'Entrar a la Sala' : 'Entrar (Apertura Anticipada)'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default AgoraPage;
