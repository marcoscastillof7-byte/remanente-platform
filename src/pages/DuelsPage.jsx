import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { Swords, User, Play, Clock, Trophy, Check, X, Loader } from 'lucide-react';
import DuelEngine from '../components/duels/DuelEngine';

const DuelsPage = () => {
  const { user } = useAuth();
  const [activeDuel, setActiveDuel] = useState(null);
  const [users, setUsers] = useState([]);
  const [duels, setDuels] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const challengeUser = async (opponentId) => {
    if(!confirm('¿Seguro que quieres retar a este jugador?')) return;
    try {
      await api.post('/duels/challenge', { opponent_id: opponentId });
      alert('¡Reto enviado!');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error enviando el reto.');
    }
  };

  const playDuel = (duel) => {
    setActiveDuel(duel);
  };

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

  if (loading) {
    return <Loader className="w-8 h-8 animate-spin text-gold mx-auto mt-20" />;
  }

  const myTurnDuels = duels.filter(d => 
    d.status !== 'completed' &&
    ((d.challenger_id === user.id && !d.challenger_completed) || 
     (d.opponent_id === user.id && !d.opponent_completed))
  );

  const waitingDuels = duels.filter(d => 
    d.status !== 'completed' &&
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
          <p className="text-sm opacity-80">Reta a tus amigos a una batalla asíncrona de 5 preguntas. El mejor puntaje en menor tiempo gana.</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-primary mb-4 flex items-center gap-2">
            <User className="w-5 h-5" /> Retar a un Jugador
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="font-medium text-gray-700">{u.username}</span>
                <button
                  onClick={() => challengeUser(u.id)}
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
        
        {/* Tu Turno */}
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
                const enemyName = isChallenger ? d.opponent.username : d.challenger.username;
                return (
                  <div key={d.id} className="bg-white p-4 rounded-lg border-l-4 border-success shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">
                        {isChallenger ? 'Tú retaste a' : 'Fuiste retado por'}
                      </div>
                      <div className="font-bold text-lg">{enemyName}</div>
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

        {/* Esperando Oponente */}
        <div>
          <h3 className="font-[Cinzel] text-xl font-bold text-gray-600 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" /> Esperando al oponente
          </h3>
          {waitingDuels.length === 0 ? (
            <p className="text-gray-500 italic bg-gray-50 p-4 rounded-lg">No estás esperando a nadie.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {waitingDuels.map(d => {
                const enemyName = d.challenger_id === user.id ? d.opponent.username : d.challenger.username;
                return (
                  <div key={d.id} className="bg-gray-50 p-4 rounded-lg border shadow-sm flex items-center justify-between opacity-75">
                    <span className="font-medium">Duelo contra {enemyName}</span>
                    <span className="text-sm text-warning font-bold flex items-center gap-1">
                      <Clock className="w-4 h-4" /> En espera
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
                    <th className="px-4 py-3 text-center">Tú</th>
                    <th className="px-4 py-3 text-center">Él/Ella</th>
                    <th className="px-4 py-3 text-center">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {completedDuels.map(d => {
                    const isChallenger = d.challenger_id === user.id;
                    const enemyName = isChallenger ? d.opponent.username : d.challenger.username;
                    const myScore = isChallenger ? d.challenger_score : d.opponent_score;
                    const enemyScore = isChallenger ? d.opponent_score : d.challenger_score;
                    const myTime = isChallenger ? d.challenger_time : d.opponent_time;
                    
                    const iWon = d.winner_id === user.id;
                    const isTie = !d.winner_id;

                    return (
                      <tr key={d.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{enemyName}</td>
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
    </div>
  );
};

export default DuelsPage;
