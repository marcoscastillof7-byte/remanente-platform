import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import { Flame, Target, Award, ArrowRight, BookOpen, Loader } from 'lucide-react';

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

  // Estados para sugerencias
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestionType, setSuggestionType] = useState('Sugerencia de Mejora');
  const [suggestionText, setSuggestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const dailyVerse = verses[new Date().getDate() % verses.length];

  const handleSuggestionSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/reports/general', {
        reason: suggestionType,
        details: suggestionText
      });
      alert('¡Sugerencia enviada! Muchas gracias por ayudarnos a mejorar.');
      setShowSuggestion(false);
      setSuggestionText('');
      setSuggestionType('Sugerencia de Mejora');
    } catch (err) {
      console.error(err);
      alert('Error al enviar sugerencia. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

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

      {/* Sugerencias Button */}
      <div className="mt-12 text-center">
        <button
          onClick={() => setShowSuggestion(true)}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors font-medium text-sm shadow-sm"
        >
          💡 ¿Tienes una sugerencia o encontraste un error? Cuéntanos.
        </button>
      </div>

      {/* Sugerencias Modal */}
      {showSuggestion && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="font-[Cinzel] text-xl font-bold text-primary mb-2">Buzón de Sugerencias</h2>
            <p className="text-sm text-gray-500 mb-4">Ayúdanos a mejorar. Si tienes una idea nueva o viste algo que no funciona bien, descríbelo aquí.</p>
            
            <form onSubmit={handleSuggestionSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Tipo</label>
                <select 
                  value={suggestionType} 
                  onChange={(e) => setSuggestionType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gold text-sm"
                >
                  <option value="Sugerencia de Mejora">Sugerencia de Mejora</option>
                  <option value="Reporte de Error / Bug">Reporte de Error / Bug</option>
                  <option value="Idea Nueva">Idea Nueva</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Detalles</label>
                <textarea
                  value={suggestionText}
                  onChange={(e) => setSuggestionText(e.target.value)}
                  className="w-full h-24 p-2 border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-gold text-sm"
                  placeholder="Explícanos tu idea o el problema que encontraste..."
                  required
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSuggestion(false)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !suggestionText.trim()}
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-light text-sm font-bold disabled:opacity-50"
                >
                  {submitting ? 'Enviando...' : 'Enviar Sugerencia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
