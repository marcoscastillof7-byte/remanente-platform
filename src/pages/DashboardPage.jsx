import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import { Flame, Target, Award, ArrowRight, BookOpen, Loader, Radio, Swords, Users, Trophy, Sparkles } from 'lucide-react';

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
  const [onlineCount, setOnlineCount] = useState(1);
  const dailyVerse = verses[new Date().getDate() % verses.length];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [booksData, profileData, onlineData] = await Promise.all([
          api.get('/books'),
          api.get('/auth/profile'),
          api.get('/stats/online').catch(() => ({ onlineCount: 1 }))
        ]);
        setBooks(booksData);
        setStreak(profileData.streak);
        if (onlineData && typeof onlineData.onlineCount === 'number') {
          setOnlineCount(Math.max(1, onlineData.onlineCount));
        }
      } catch (err) {
        console.error('Error cargando dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Escuchar actualizaciones en tiempo real desde la plataforma
    const handleOnlineUpdate = (e) => {
      if (e.detail && typeof e.detail.onlineCount === 'number') {
        setOnlineCount(Math.max(1, e.detail.onlineCount));
      }
    };

    window.addEventListener('platform-online-update', handleOnlineUpdate);
    return () => {
      window.removeEventListener('platform-online-update', handleOnlineUpdate);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  const safeBooks = Array.isArray(books) ? books : [];
  const totalQuizzes = safeBooks.reduce((sum, b) => sum + (b?.quizzes_completed || 0), 0);
  const booksWithScore = safeBooks.filter(b => b?.avg_score);
  const avgScore = booksWithScore.length > 0
    ? Math.round(booksWithScore.reduce((sum, b) => sum + (b?.avg_score || 0), 0) / booksWithScore.length)
    : 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-primary rounded-xl p-4 sm:p-6 md:p-8 text-white mb-8 shadow-lg relative overflow-hidden border border-gold/30">
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 pointer-events-none">
          <BookOpen className="w-64 h-64 text-gold" />
        </div>
        <div className="relative z-10">
          <h1 className="font-[Cinzel] text-2xl sm:text-3xl md:text-4xl font-bold text-gold mb-1">
            {user?.groups?.name || 'Olimpiadas GVY'}
          </h1>
          <p className="text-lg sm:text-xl text-white font-medium mb-3">
            Hola, {user?.username}
          </p>
          <p className="text-sm sm:text-base md:text-lg opacity-90 max-w-2xl italic leading-relaxed">
            {dailyVerse}
          </p>
          <div className="mt-5 sm:mt-6 flex flex-wrap gap-2.5 sm:gap-4">
            <div className="bg-white/10 rounded-lg p-2.5 sm:p-3 flex items-center backdrop-blur-sm border border-white/20 flex-1 min-w-[130px]">
              <Flame className={`w-5 h-5 sm:w-6 sm:h-6 mr-2 shrink-0 ${streak?.current_streak > 0 ? 'text-orange-400' : 'text-gray-300'}`} />
              <div>
                <div className="text-[10px] sm:text-xs opacity-80 uppercase tracking-wide">Racha Actual</div>
                <div className="font-bold text-base sm:text-xl flex items-center gap-1.5">
                  <span>{streak?.current_streak || 0} Días</span>
                  {streak?.studied_today ? (
                    <span className="text-[10px] bg-green-500/30 text-green-200 border border-green-400/30 px-1.5 py-0.5 rounded font-normal">
                      ✓ Hoy
                    </span>
                  ) : streak?.current_streak > 0 ? (
                    <span className="text-[10px] bg-amber-500/30 text-amber-200 border border-amber-400/30 px-1.5 py-0.5 rounded font-normal animate-pulse">
                      ¡Hoy!
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5 sm:p-3 flex items-center backdrop-blur-sm border border-white/20 flex-1 min-w-[130px]">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 mr-2 shrink-0" />
              <div>
                <div className="text-[10px] sm:text-xs opacity-80 uppercase tracking-wide">Quizzes Totales</div>
                <div className="font-bold text-base sm:text-xl">{totalQuizzes}</div>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5 sm:p-3 flex items-center backdrop-blur-sm border border-white/20 flex-1 min-w-[130px]">
              <Award className="w-5 h-5 sm:w-6 sm:h-6 text-gold mr-2 shrink-0" />
              <div>
                <div className="text-[10px] sm:text-xs opacity-80 uppercase tracking-wide">Puntaje Medio</div>
                <div className="font-bold text-base sm:text-xl">{avgScore}%</div>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5 sm:p-3 flex items-center backdrop-blur-sm border border-white/20 flex-1 min-w-[130px]">
              <div className="relative mr-2 shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full"></span>
              </div>
              <div>
                <div className="text-[10px] sm:text-xs opacity-80 uppercase tracking-wide">En Plataforma</div>
                <div className="font-bold text-base sm:text-xl text-emerald-300 flex items-center gap-1.5">
                  <span>{onlineCount}</span>
                  <span className="text-[10px] font-normal text-emerald-200/80 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                    {onlineCount === 1 ? 'activo' : 'activos'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de acción rápida dentro del cuadro azul */}
          <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-white/20 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
            <Link
              to="/simulacro"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl text-sm md:text-base shadow-xl shadow-amber-500/30 hover:scale-102 sm:hover:scale-105 transition-all transform shrink-0 group cursor-pointer text-center border border-amber-300"
            >
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 animate-bounce group-hover:scale-110 transition-transform shrink-0" />
              <span>Simulacro Oficial</span>
              <span className="bg-slate-950 text-amber-300 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-extrabold whitespace-nowrap">
                ¡NUEVO! 🏆
              </span>
            </Link>

            <Link
              to="/meet"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-gold via-gold-light to-gold hover:from-gold-dark hover:to-gold text-slate-900 font-black px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl text-sm md:text-base shadow-xl shadow-gold/25 hover:scale-102 sm:hover:scale-105 transition-all transform shrink-0 group cursor-pointer text-center"
            >
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 animate-pulse group-hover:scale-110 transition-transform shrink-0" />
              <span>Remanente Meet</span>
              <span className="bg-slate-900/15 text-slate-900 text-[11px] sm:text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                En Vivo 📖
              </span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/duels"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm border border-white/20 transition-all hover:scale-102 shrink-0 text-center"
              >
                <Swords className="w-4 h-4 text-gold shrink-0" />
                <span>Duelos Bíblicos</span>
              </Link>

              <Link
                to="/survival"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm border border-white/20 transition-all hover:scale-102 shrink-0 text-center"
              >
                <Flame className="w-4 h-4 text-orange-400 shrink-0" />
                <span>Supervivencia</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Banner Destacado: Gran Sección de Simulacro Oficial */}
      <div className="mb-8 p-5 sm:p-7 rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 border-2 border-amber-500/50 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 blur-3xl rounded-full pointer-events-none"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center text-3xl shadow-xl shadow-amber-500/30 shrink-0 border-2 border-amber-300">
            🏆
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 shadow">
                ¡NUEVA SECCIÓN HABILITADA!
              </span>
              <span className="text-xs text-amber-300 font-semibold font-mono">
                Reglamento Oficial NTV
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-serif text-white mt-1">
              Simulacro de Competencia (4 Categorías)
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
              Compite en <strong>Fire Questions</strong> (90s con 5 subcategorías), <strong>David contra Goliat</strong> (pulsador y duelos 1 vs 1 con opciones desbloqueables), <strong>El Dado Dado</strong> y <strong>La Ruleta</strong> (relojes automáticos de 30s).
            </p>
          </div>
        </div>

        <Link
          to="/simulacro"
          className="w-full md:w-auto px-6 py-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-2xl text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2.5 transition-all hover:scale-105 active:scale-95 shrink-0 relative z-10 border border-amber-300 cursor-pointer"
        >
          <Trophy className="w-5 h-5 text-slate-950" />
          <span>Entrar al Simulacro</span>
          <ArrowRight className="w-4 h-4 text-slate-950" />
        </Link>
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
