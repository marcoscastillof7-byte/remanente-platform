import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import { Flame, Target, Award, ArrowRight, BookOpen, Loader } from 'lucide-react';

const verses = [
  '"Procura con diligencia presentarte a Dios aprobado, como obrero que no tiene de qué avergonzarse." — 2 Timoteo 2:15',
  '"Lámpara es a mis pies tu palabra, y lumbrera a mi camino." — Salmo 119:105',
  '"Toda la Escritura es inspirada por Dios, y útil para enseñar." — 2 Timoteo 3:16',
  '"Bienaventurado el que lee, y los que oyen las palabras de esta profecía." — Apocalipsis 1:3',
  '"El principio de la sabiduría es el temor de Jehová." — Proverbios 9:10',
  '"Porque la palabra de Dios es viva y eficaz." — Hebreos 4:12',
  '"Tu palabra es verdad." — Juan 17:17',
  '"De Jehová es la tierra y su plenitud." — Salmo 24:1',
  '"Esforzaos y cobrad ánimo; no temáis ni tengáis miedo." — Deuteronomio 31:6',
  '"Confía en Jehová con todo tu corazón." — Proverbios 3:5',
];

const DashboardPage = () => {
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(null);

  const dailyVerse = verses[new Date().getDate() % verses.length];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [booksData, profileData] = await Promise.all([
          api.get('/books'),
          api.get('/auth/profile'),
        ]);
        setBooks(booksData);
        setStreak(profileData.streak);
      } catch (err) {
        console.error('Error cargando dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  const totalQuizzes = books.reduce((sum, b) => sum + (b.quizzes_completed || 0), 0);
  const avgScore = books.filter(b => b.avg_score).length > 0
    ? Math.round(books.reduce((sum, b) => sum + (b.avg_score || 0), 0) / books.filter(b => b.avg_score).length)
    : 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-primary rounded-xl p-8 text-white mb-8 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
          <BookOpen className="w-64 h-64 text-gold" />
        </div>
        <div className="relative z-10">
          <h1 className="font-[Cinzel] text-3xl md:text-4xl font-bold text-gold mb-2">
            Bienvenido, {user?.username}
          </h1>
          <p className="text-lg opacity-90 max-w-2xl italic">
            {dailyVerse}
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="bg-white/10 rounded-lg p-3 flex items-center backdrop-blur-sm border border-white/20">
              <Flame className="w-6 h-6 text-orange-400 mr-2" />
              <div>
                <div className="text-xs opacity-80 uppercase tracking-wide">Racha Actual</div>
                <div className="font-bold text-xl">{streak?.current_streak || 0} Días</div>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 flex items-center backdrop-blur-sm border border-white/20">
              <Target className="w-6 h-6 text-green-400 mr-2" />
              <div>
                <div className="text-xs opacity-80 uppercase tracking-wide">Quizzes Totales</div>
                <div className="font-bold text-xl">{totalQuizzes}</div>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 flex items-center backdrop-blur-sm border border-white/20">
              <Award className="w-6 h-6 text-gold mr-2" />
              <div>
                <div className="text-xs opacity-80 uppercase tracking-wide">Puntaje Medio</div>
                <div className="font-bold text-xl">{avgScore}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="font-[Cinzel] text-2xl font-bold text-primary mb-6 border-b-2 border-gold pb-2 inline-block">
        Tus Libros de Estudio
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {books.map((book) => (
          <div key={book.id} className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow flex flex-col h-full">
            <h3 className="font-[Cinzel] font-bold text-xl text-primary-dark mb-2">{book.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{book.chapters_count} capítulos</p>

            <div className="mb-4 flex-1">
              <div className="flex justify-between text-sm mb-1 text-gray-600">
                <span>Progreso</span>
                <span className="font-medium">{book.chapters_completed || 0}/{book.chapters_count}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-gold h-2.5 rounded-full transition-all"
                  style={{ width: `${((book.chapters_completed || 0) / book.chapters_count) * 100}%` }}
                ></div>
              </div>

              {book.avg_score > 0 && (
                <div className="mt-4 flex justify-between text-sm text-gray-600">
                  <span>Promedio</span>
                  <span className="font-medium">{Math.round(book.avg_score)}%</span>
                </div>
              )}
            </div>

            <Link
              to={`/books/${book.id}`}
              className="mt-4 w-full flex items-center justify-center py-2 px-4 bg-primary text-white rounded hover:bg-primary-light transition-colors text-sm font-medium"
            >
              Continuar <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
