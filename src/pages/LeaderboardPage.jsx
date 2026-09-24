import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Loader, Trophy, Medal, Flame, Target } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const LeaderboardPage = () => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('global');
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

  const fetchByBook = async (bookId) => {
    setActiveTab(bookId);
    setLoading(true);
    try {
      const data = await api.get(`/leaderboard/${bookId}`);
      setLeaderboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobal = async () => {
    setActiveTab('global');
    setLoading(true);
    try {
      const data = await api.get('/leaderboard');
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
      <h1 className="font-[Cinzel] text-3xl font-bold text-primary mb-2 flex items-center gap-3">
        <Trophy className="w-8 h-8 text-gold" /> Tabla de Honor
      </h1>
      <p className="text-gray-600 mb-8">Los mejores estudiantes de la plataforma.</p>

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
                <th className="px-4 py-3 text-center">Puntaje</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Quizzes</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Promedio</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Racha</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => (
                <tr
                  key={entry.username}
                  className={`border-t ${entry.username === user?.username ? 'bg-gold/10 font-bold' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-4 py-3 text-lg">{getMedal(i + 1)}</td>
                  <td className="px-4 py-3">
                    <span className={entry.username === user?.username ? 'text-primary font-bold' : ''}>
                      {entry.username}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-primary">{entry.total_score || 0}</td>
                  <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">{entry.quizzes_completed || 0}</td>
                  <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">{Math.round(entry.avg_score || 0)}%</td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className="flex items-center justify-center gap-1">
                      <Flame className="w-4 h-4 text-orange-400" /> {entry.current_streak || 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;
