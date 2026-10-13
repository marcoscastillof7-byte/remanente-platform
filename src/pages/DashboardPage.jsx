import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import { Flame, Target, Award, ArrowRight, BookOpen, Loader, Radio, Swords, Users } from 'lucide-react';

const verses = [
  '"Procura con diligencia presentarte a Dios aprobado, como obrero que no tiene de qué avergonzarse." — 2 Timoteo 2:15',
  '"Lámpara es a mis pies tu palabra, y lumbrera a mi camino." — Salmo 119:105',
  '"Toda la Escritura es inspirada por Dios, y útil para enseñar." — 2 Timoteo 3:16',
  '"Solamente temed a Jehová y servidle de verdad con todo vuestro corazón, pues considerad cuán grandes cosas ha hecho por vosotros." — 1 Samuel 12:24',
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
          api.get('/auth/profile')
        ]);
        setBooks(booksData);
        setStreak(profileData.streak);      } catch (err) {
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
          <h1 className="font-[Cinzel] text-3xl md:text-4xl font-bold text-gold mb-1">
            {user?.groups?.name || 'Olimpiadas GVY'}
          </h1>
          <p className="text-xl text-white font-medium mb-4">
            Hola, {user?.username}
          </p>
          <p className="text-lg opacity-90 max-w-2xl italic">
            {dailyVerse}
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="bg-white/10 rounded-lg p-3 flex items-center backdrop-blur-sm border border-white/20">
              <Flame className={`w-6 h-6 mr-2 ${streak?.current_streak > 0 ? 'text-orange-400' : 'text-gray-300'}`} />
              <div>
                <div className="text-xs opacity-80 uppercase tracking-wide">Racha Actual</div>
                <div className="font-bold text-xl flex items-center gap-2">
                  <span>{streak?.current_streak || 0} Días</span>
                  {streak?.studied_today ? (
                    <span className="text-[11px] bg-green-500/30 text-green-200 border border-green-400/30 px-1.5 py-0.5 rounded font-normal">
                      ✓ Hoy
                    </span>
                  ) : streak?.current_streak > 0 ? (
                    <span className="text-[11px] bg-amber-500/30 text-amber-200 border border-amber-400/30 px-1.5 py-0.5 rounded font-normal animate-pulse">
                      ¡Estudia hoy!
                    </span>
                  ) : null}
                </div>
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

          {/* Botones de acción rápida dentro del cuadro azul */}
          <div className="mt-8 pt-6 border-t border-white/20 flex flex-wrap items-center gap-3">
            <Link
              to="/meet"
              className="inline-flex items-center gap-2.5 bg-gradient-to-r from-gold via-gold-light to-gold hover:from-gold-dark hover:to-gold text-slate-900 font-black px-6 py-3.5 rounded-xl text-sm md:text-base shadow-xl shadow-gold/25 hover:scale-105 transition-all transform shrink-0 group cursor-pointer"
            >
              <Radio className="w-5 h-5 text-red-600 animate-pulse group-hover:scale-110 transition-transform" />
              <span>Entrar a Remanente Meet</span>
              <span className="bg-slate-900/15 text-slate-900 text-xs px-2 py-0.5 rounded-full font-bold">
                En Vivo 📖
              </span>
            </Link>

            <Link
              to="/duels"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-3 rounded-xl text-sm border border-white/20 transition-all hover:scale-102 shrink-0"
            >
              <Swords className="w-4 h-4 text-gold" />
              <span>Duelos Bíblicos</span>
            </Link>

            <Link
              to="/survival"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-3 rounded-xl text-sm border border-white/20 transition-all hover:scale-102 shrink-0"
            >
              <Flame className="w-4 h-4 text-orange-400" />
              <span>Supervivencia</span>
            </Link>
          </div>
        </div>
      </div>

      <h2 className="font-[Cinzel] text-2xl font-bold text-primary mb-6 border-b-2 border-gold pb-2 inline-block">
        Tus Libros de Estudio
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {books.map((book) => {
          const isDisabled = book.is_published === false;
          return (
          <div key={book.id} className={`bg-white rounded-xl shadow-md p-6 border border-gray-100 flex flex-col h-full ${isDisabled ? 'opacity-60 relative' : 'hover:shadow-lg transition-shadow'}`}>
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

            {isDisabled ? (
              <div className="mt-4 w-full flex items-center justify-center py-2 px-4 bg-gray-300 text-gray-600 rounded cursor-not-allowed text-sm font-bold">
                Próximamente 🚧
              </div>
            ) : (
              <Link
                to={`/books/${book.id}`}
                className="mt-4 w-full flex items-center justify-center py-2 px-4 bg-primary text-white rounded hover:bg-primary-light transition-colors text-sm font-medium"
              >
                Continuar <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            )}
          </div>
        )})}
      </div>
    </div>
  );
};

export default DashboardPage;
