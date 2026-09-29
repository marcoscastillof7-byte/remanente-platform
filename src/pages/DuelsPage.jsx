import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { Swords, User, Play, Clock, Trophy, Check, X, Loader, MessageSquare, Flame } from 'lucide-react';
import DuelEngine from '../components/duels/DuelEngine';
import Modal from '../components/shared/Modal';

const DuelsPage = () => {
  const { user } = useAuth();
  const [activeDuel, setActiveDuel] = useState(null);
  const [users, setUsers] = useState([]);
  const [duels, setDuels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [wager, setWager] = useState(0);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersData, duelsData] = await Promise.all([
        api.get('/duels/users'),
        api.get('/duels')
      ]);
      setUsers(usersData);
      setDuels(duelsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openChallengeModal = (u) => {
    setSelectedUser(u);
    setWager(0);
    setMessage('');
    setIsModalOpen(true);
  };

  const submitChallenge = async (e) => {
    e.preventDefault();
    if (wager > user.points) {
      alert('No tienes suficientes puntos para esta apuesta.');
      return;
    }
    setSending(true);
    try {
      await api.post('/duels/challenge', { opponent_id: selectedUser.id, wager: parseInt(wager), message });
      setIsModalOpen(false);
      fetchData();
      alert('¡Reto enviado!');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Error enviando el reto.');
    } finally {
      setSending(false);
    }
  };

  const acceptChallenge = async (duelId) => {
    if (!confirm('¿Aceptar el reto y apostar tus puntos?')) return;
    try {
      await api.post(`/duels/${duelId}/accept`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Error al aceptar');
    }
  };

  const rejectChallenge = async (duelId) => {
    if (!confirm('¿Rechazar el reto?')) return;
    try {
      await api.post(`/duels/${duelId}/reject`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error al rechazar');
    }
  };

  const playDuel = (duel) => {
    setActiveDuel(duel);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (activeDuel) {
    return (
      <DuelEngine 
        duelId={activeDuel.id} 
        onFinish={() => {
          setActiveDuel(null);
          fetchData();
        }} 
      />
    );
  }

  const receivedChallenges = duels.filter(d => d.status === 'pending_acceptance' && d.opponent_id === user.id);
  const sentChallenges = duels.filter(d => d.status === 'pending_acceptance' && d.challenger_id === user.id);
  
  const myTurnDuels = duels.filter(d => 
    d.status === 'pending' &&
    ((d.challenger_id === user.id && !d.challenger_completed) || 
     (d.opponent_id === user.id && !d.opponent_completed))
  );

  const waitingDuels = duels.filter(d => 
    d.status === 'pending' &&
    ((d.challenger_id === user.id && d.challenger_completed) || 
     (d.opponent_id === user.id && d.opponent_completed))
  );

  const completedDuels = duels.filter(d => d.status === 'completed');

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Columna Izquierda: Retar */}
      <div className="md:col-span-1 space-y-6">
        <div className="bg-primary rounded-xl p-6 text-white text-center shadow-lg">
          <Swords className="w-16 h-16 text-gold mx-auto mb-4" />
          <h2 className="font-[Cinzel] text-2xl font-bold mb-2">Duelos Bíblicos</h2>
          <p className="text-sm opacity-80">Reta a tus amigos a una batalla asíncrona de 5 preguntas. Apuesta puntos y gana el doble.</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-primary mb-4 flex items-center gap-2">
            <User className="w-5 h-5" /> Retar a un Jugador
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <span className="font-medium text-gray-700 block flex items-center gap-2">{u.username} {u.groups?.name && <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">{u.groups.name}</span>}</span>
                  <span className="text-xs text-gray-500">{u.points || 0} pts</span>
                </div>
                <button
                  onClick={() => openChallengeModal(u)}
                  className="px-3 py-1 bg-danger text-white text-xs font-bold rounded hover:bg-red-700 transition-colors"
                >
                  RETAR
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Columna Derecha: Tus Duelos */}
      <div className="md:col-span-2 space-y-8">
        
        {/* Retos Recibidos (Nuevos) */}
        {receivedChallenges.length > 0 && (
          <div>
            <h3 className="font-[Cinzel] text-xl font-bold text-danger mb-4 flex items-center gap-2 animate-pulse">
              <Flame className="w-5 h-5" /> Retos Recibidos
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {receivedChallenges.map(d => (
                <div key={d.id} className="bg-white p-4 rounded-lg border-l-4 border-danger shadow-md">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-sm text-gray-500">Fuiste retado por</div>
                      <div className="font-bold text-lg text-primary">{d.challenger.username + (d.challenger.groups?.name ? ` [${d.challenger.groups.name}]` : "")}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Apuesta</div>
                      <div className="font-bold text-gold">{d.wager || 0} pts</div>
                    </div>
                  </div>
                  {d.message && (
                    <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 italic mb-3 border">
                      "{d.message}"
                    </div>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => rejectChallenge(d.id)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300 transition-colors text-sm">
                      Rechazar
                    </button>
                    <button onClick={() => acceptChallenge(d.id)} className="px-4 py-2 bg-success text-white rounded font-bold hover:bg-green-600 transition-colors text-sm">
                      Aceptar Reto
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Retos Enviados (Esperando) */}
        {sentChallenges.length > 0 && (
          <div>
            <h3 className="font-[Cinzel] text-xl font-bold text-gray-600 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" /> Retos Enviados (En Espera)
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {sentChallenges.map(d => (
                <div key={d.id} className="bg-gray-50 p-4 rounded-lg border shadow-sm flex items-center justify-between opacity-75">
                  <div>
                    <span className="font-medium block">Retaste a {d.opponent.username + (d.opponent.groups?.name ? ` [${d.opponent.groups.name}]` : "")}</span>
                    <span className="text-sm text-gray-500">Apuesta: {d.wager} pts</span>
                  </div>
                  <span className="text-sm text-warning font-bold">
                    Esperando respuesta...
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tu Turno (Aceptados) */}
        <div>
          <h3 className="font-[Cinzel] text-xl font-bold text-primary mb-4 flex items-center gap-2">
            <Play className="w-5 h-5 text-success" /> ¡Es tu turno!
          </h3>
          {myTurnDuels.length === 0 ? (
            <p className="text-gray-500 italic bg-gray-50 p-4 rounded-lg">No tienes duelos pendientes por jugar.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {myTurnDuels.map(d => {
                const isChallenger = d.challenger_id === user.id;
                const enemyName = isChallenger ? d.opponent.username + (d.opponent.groups?.name ? ` [${d.opponent.groups.name}]` : "") : d.challenger.username + (d.challenger.groups?.name ? ` [${d.challenger.groups.name}]` : "");
                return (
                  <div key={d.id} className="bg-white p-4 rounded-lg border-l-4 border-success shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">
                        Duelo Activo vs
                      </div>
                      <div className="font-bold text-lg">{enemyName}</div>
                      <div className="text-xs text-gold font-bold mt-1">Apuesta: {d.wager || 0} pts</div>
                    </div>
                    <button
                      onClick={() => playDuel(d)}
                      className="px-6 py-2 bg-success text-white rounded-lg font-bold hover:bg-green-600 transition-colors shadow-sm"
                    >
                      JUGAR AHORA
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Esperando Oponente (Aceptados pero ya jugaste) */}
        <div>
          <h3 className="font-[Cinzel] text-xl font-bold text-gray-600 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" /> Esperando jugada del oponente
          </h3>
          {waitingDuels.length === 0 ? (
            <p className="text-gray-500 italic bg-gray-50 p-4 rounded-lg">No estás esperando a nadie.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {waitingDuels.map(d => {
                const enemyName = d.challenger_id === user.id ? d.opponent.username + (d.opponent.groups?.name ? ` [${d.opponent.groups.name}]` : "") : d.challenger.username + (d.challenger.groups?.name ? ` [${d.challenger.groups.name}]` : "");
                return (
                  <div key={d.id} className="bg-gray-50 p-4 rounded-lg border shadow-sm flex items-center justify-between opacity-75">
                    <span className="font-medium">Duelo vs {enemyName}</span>
                    <span className="text-sm text-warning font-bold flex items-center gap-1">
                      <Clock className="w-4 h-4" /> Él/Ella está jugando
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Historial Completados */}
        <div>
          <h3 className="font-[Cinzel] text-xl font-bold text-primary mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold" /> Historial de Batallas
          </h3>
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            {completedDuels.length === 0 ? (
              <p className="p-6 text-gray-500 text-center italic">Aún no has completado ningún duelo.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b">
                    <th className="px-4 py-3 text-left">Oponente</th>
                    <th className="px-4 py-3 text-center">Apuesta</th>
                    <th className="px-4 py-3 text-center">Tú</th>
                    <th className="px-4 py-3 text-center">Él/Ella</th>
                    <th className="px-4 py-3 text-center">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {completedDuels.map(d => {
                    const isChallenger = d.challenger_id === user.id;
                    const enemyName = isChallenger ? d.opponent.username + (d.opponent.groups?.name ? ` [${d.opponent.groups.name}]` : "") : d.challenger.username + (d.challenger.groups?.name ? ` [${d.challenger.groups.name}]` : "");
                    const myScore = isChallenger ? d.challenger_score : d.opponent_score;
                    const enemyScore = isChallenger ? d.opponent_score : d.challenger_score;
                    const myTime = isChallenger ? d.challenger_time : d.opponent_time;
                    
                    const iWon = d.winner_id === user.id;
                    const isTie = !d.winner_id;

                    return (
                      <tr key={d.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{enemyName}</td>
                        <td className="px-4 py-3 text-center text-gold font-bold">{d.wager || 0}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold">{myScore}%</span> <span className="text-xs text-gray-400">({myTime}s)</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold">{enemyScore}%</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isTie ? (
                            <span className="inline-flex items-center gap-1 text-gray-500 font-bold bg-gray-100 px-2 py-1 rounded">
                              EMPATE
                            </span>
                          ) : iWon ? (
                            <span className="inline-flex items-center gap-1 text-success font-bold bg-green-100 px-2 py-1 rounded">
                              <Check className="w-4 h-4" /> VICTORIA
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-danger font-bold bg-red-100 px-2 py-1 rounded">
                              <X className="w-4 h-4" /> DERROTA
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* Modal de Reto */}
      {isModalOpen && selectedUser && (
        <Modal 
          isOpen={true}
          title={`Retar a ${selectedUser.username}`} 
          onClose={() => setIsModalOpen(false)}
        >
          <form onSubmit={submitChallenge} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Puntos a apostar
              </label>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-gold" />
                <input 
                  type="number" 
                  min="0" 
                  max={user.points} 
                  value={wager} 
                  onChange={(e) => setWager(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-gold outline-none"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Tienes {user.points} puntos disponibles. El ganador se lleva todo.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Mensaje (Opcional)
              </label>
              <div className="flex gap-2">
                <MessageSquare className="w-5 h-5 text-gray-400 mt-2" />
                <textarea 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="¡Prepárate para perder!"
                  className="w-full p-2 border rounded resize-none focus:ring-2 focus:ring-gold outline-none h-20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t mt-6">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={sending || wager > user.points}
                className="px-6 py-2 bg-danger text-white font-bold rounded shadow hover:bg-red-700 disabled:opacity-50"
              >
                {sending ? 'Enviando...' : 'Enviar Reto'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default DuelsPage;
