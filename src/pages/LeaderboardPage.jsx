import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { getRankInfo } from '../utils/ranks';
import { Loader, Trophy, Medal, Flame, Target, Gift } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const LeaderboardPage = () => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('global');
  const [isInternal, setIsInternal] = useState(false);
  const [books, setBooks] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lb, booksData] = await Promise.all([
          api.get('/leaderboard'),
          api.get('/books'),
        ]);
        setLeaderboard(lb);
        setBooks(booksData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const fetchByBook = async (bookId, internal = isInternal) => {
    setActiveTab(bookId);
    setLoading(true);
    try {
      const data = await api.get(`/leaderboard/${bookId}?internal=${internal}`);
      setLeaderboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobal = async (internal = isInternal) => {
    setActiveTab('global');
    setLoading(true);
    try {
      const data = await api.get(`/leaderboard?internal=${internal}`);
      setLeaderboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getMedal = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-[Cinzel] text-3xl font-bold text-primary mb-2 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-gold" /> Tabla de Honor
          </h1>
          <p className="text-gray-600">Los mejores estudiantes de la plataforma.</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200 self-start sm:self-auto">
          <span className={!isInternal ? "text-sm font-bold text-primary" : "text-sm font-bold text-gray-400"}>General</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={isInternal} onChange={(e) => {
               const val = e.target.checked;
               setIsInternal(val);
               if (activeTab === 'global') fetchGlobal(val);
               else fetchByBook(activeTab, val);
            }} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold"></div>
          </label>
          <span className={isInternal ? "text-sm font-bold text-primary" : "text-sm font-bold text-gray-400"}>Mi Equipo</span>
        </div>
      </div>

      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-gold p-4 mb-8 rounded-r-lg shadow-sm">
          <p className="text-sm text-yellow-800 font-medium flex items-center gap-2">
            <Gift className="w-6 h-6 text-gold flex-shrink-0" />
            <span>
              <strong>¡Gran Premio!</strong> La persona que quede <strong>Top 1</strong> en el marcador general antes del <strong>31 de octubre</strong> se llevará un premio especial. ¡Sigue esforzándote!
            </span>
          </p>
        </div>

        {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={fetchGlobal}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'global' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          General
        </button>
        {books.map(book => (
          <button
            key={book.id}
            onClick={() => fetchByBook(book.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === book.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {book.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader className="w-8 h-8 animate-spin text-gold" />
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>Aún no hay datos. ¡Sé el primero en completar un quiz!</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-primary text-white text-sm">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Usuario</th>
                {activeTab === 'global' ? (
                  <th className="px-4 py-3 text-center">Puntos</th>
                ) : (
                  <th className="px-4 py-3 text-center">Score Total</th>
                )}
                {activeTab === 'global' && <th className="px-4 py-3 text-left">Rango</th>}
                <th className="px-4 py-3 text-center hidden md:table-cell">Quizzes</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Promedio</th>
                {activeTab === 'global' && <th className="px-4 py-3 text-center hidden md:table-cell">Racha</th>}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => {
                const isUser = entry.username === user?.username;
                const points = entry.points || 0;
                const rank = getRankInfo(points);
                return (
                <tr
                  key={entry.username}
                  className={`border-t ${isUser ? 'bg-gold/10 font-bold' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-4 py-3 text-lg">{getMedal(i + 1)}</td>
                  <td className="px-4 py-3">
                    <span className={isUser ? "text-primary font-bold flex flex-wrap items-center gap-2" : "flex flex-wrap items-center gap-2"}>
                        <span>{entry.username}</span>
                        {!isInternal && entry.groupName && (
                          <span className="text-[10px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                            {entry.groupName}
                          </span>
                        )}
                      </span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-primary">
                    {activeTab === 'global' ? points : (entry.total_score || 0)}
                  </td>
                  
                  {activeTab === 'global' && (
                    <td className="px-4 py-3 text-left text-sm" title={rank.name}>
                      <span className="flex items-center gap-1">{rank.icon} <span className="hidden sm:inline text-xs text-gray-500 font-normal">{rank.name}</span></span>
                    </td>
                  )}
                  
                  <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">{entry.quizzes_completed || 0}</td>
                  <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">{Math.round(entry.avg_score || 0)}%</td>
                  
                  {activeTab === 'global' && (
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {entry.current_streak > 0 ? (
                        <span className="flex items-center justify-center gap-1 text-orange-500 font-bold">
                          <Flame className="w-4 h-4" /> {entry.current_streak}
                        </span>
                      ) : '-'}
                    </td>
                  )}
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;
