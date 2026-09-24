import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { api } from '../../utils/api';
import { ArrowLeft, Loader, BookOpen, Target, Flame } from 'lucide-react';

const UserPerformance = () => {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.get(`/admin/users/${userId}/performance`);
        setData(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-gray-500 py-16">No se encontró información del usuario.</p>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Link to="/admin" className="inline-flex items-center gap-2 text-primary hover:text-primary-light mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver al Panel
      </Link>

      {/* User Header */}
      <div className="bg-primary rounded-xl p-6 text-white mb-8 shadow-lg">
        <h1 className="font-[Cinzel] text-2xl font-bold text-gold mb-2">
          Rendimiento de: {data.username}
        </h1>
        <div className="flex flex-wrap gap-4 mt-4">
          <div className="bg-white/10 rounded-lg p-3 border border-white/20">
            <div className="text-xs opacity-80">Quizzes Totales</div>
            <div className="text-xl font-bold">{data.total_quizzes || 0}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 border border-white/20">
            <div className="text-xs opacity-80">Score Promedio</div>
            <div className="text-xl font-bold">{Math.round(data.avg_score || 0)}%</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 border border-white/20">
            <div className="text-xs opacity-80">Racha</div>
            <div className="text-xl font-bold flex items-center gap-1">
              <Flame className="w-5 h-5 text-orange-400" /> {data.current_streak || 0}
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 border border-white/20">
            <div className="text-xs opacity-80">Última Actividad</div>
            <div className="text-xl font-bold">
              {data.last_active ? new Date(data.last_active).toLocaleDateString('es') : 'Nunca'}
            </div>
          </div>
        </div>
      </div>

      {/* Logros del Estudiante */}
      {data.achievements && data.achievements.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border mb-8 p-6">
          <h3 className="font-[Cinzel] text-xl font-bold text-primary mb-4">Logros Desbloqueados</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {data.achievements.map(ach => (
              <div key={ach.id} className="bg-gray-50 border rounded-lg p-4 text-center flex flex-col items-center">
                <div className="text-3xl mb-2">{ach.icon}</div>
                <div className="font-bold text-sm text-primary mb-1">{ach.name}</div>
                <div className="text-xs text-gray-500 mb-2">{ach.description}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                  {new Date(ach.earned_at).toLocaleDateString('es')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Book Stats */}
      {data.books && data.books.map(book => (
        <div key={book.book_id || book.name} className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
          <div className="p-4 bg-parchment border-b flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-gold" />
            <h3 className="font-[Cinzel] font-bold text-lg text-primary">{book.name}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="px-4 py-2 text-left">Capítulo</th>
                  <th className="px-4 py-2 text-center">Intentos</th>
                  <th className="px-4 py-2 text-center">Mejor Score</th>
                  <th className="px-4 py-2 text-center">Promedio</th>
                  <th className="px-4 py-2 text-center">Último Intento</th>
                </tr>
              </thead>
              <tbody>
                {book.chapters && book.chapters.map(ch => (
                  <tr key={ch.chapter_id || ch.chapter_number} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <span className="font-medium">Cap. {ch.chapter_number}</span>
                      {ch.title && <span className="text-gray-400 ml-2 text-xs">— {ch.title}</span>}
                    </td>
                    <td className="px-4 py-2 text-center">{ch.attempts || 0}</td>
                    <td className="px-4 py-2 text-center">
                      {ch.best_score != null ? (
                        <span className={`font-bold ${ch.best_score >= 80 ? 'text-success' : ch.best_score >= 60 ? 'text-warning' : 'text-danger'}`}>
                          {ch.best_score}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2 text-center">{ch.avg_score != null ? `${Math.round(ch.avg_score)}%` : '—'}</td>
                    <td className="px-4 py-2 text-center text-gray-400 text-xs">
                      {ch.last_attempt ? new Date(ch.last_attempt).toLocaleDateString('es') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UserPerformance;
