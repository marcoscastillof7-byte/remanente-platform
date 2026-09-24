import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { ChevronDown, ChevronRight, Book, CheckCircle, Clock, Circle, MessageSquare } from 'lucide-react';
import { api } from '../../utils/api';

const Sidebar = () => {
  const [books, setBooks] = useState([]);
  const [expandedBooks, setExpandedBooks] = useState({});
  const [chaptersByBook, setChaptersByBook] = useState({});
  const location = useLocation();

  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestionType, setSuggestionType] = useState('Sugerencia de Mejora');
  const [suggestionText, setSuggestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    const fetchBooks = async () => {
      try {
        const data = await api.get('/books');
        setBooks(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBooks();
  }, []);

  if (location.pathname.startsWith('/admin')) return null;
  if (location.pathname === '/login' || location.pathname === '/register') return null;

  const toggleBook = async (bookId) => {
    setExpandedBooks(prev => ({ ...prev, [bookId]: !prev[bookId] }));
    if (!chaptersByBook[bookId]) {
      try {
        const data = await api.get(`/books/${bookId}/chapters`);
        setChaptersByBook(prev => ({ ...prev, [bookId]: data.chapters || data }));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getChapterIcon = (ch) => {
    if (ch.best_score >= 80) return <CheckCircle className="w-3 h-3 text-green-500" />;
    if (ch.attempts > 0) return <Clock className="w-3 h-3 text-yellow-500" />;
    return <Circle className="w-3 h-3 text-gray-300" />;
  };

  return (
    <aside className="w-64 bg-white border-r border-parchment-dark hidden md:block overflow-y-auto shrink-0">
      <div className="p-4">
        <h2 className="font-[Cinzel] font-bold text-lg text-primary mb-4 flex items-center">
          <Book className="w-5 h-5 mr-2 text-gold" />
          Libros de Estudio
        </h2>

        <div className="space-y-2">
          {books.map(book => (
            <div key={book.id}>
              <button
                onClick={() => toggleBook(book.id)}
                className="w-full flex items-center justify-between p-2 rounded-md hover:bg-parchment transition-colors text-left"
              >
                <span className="font-medium text-gray-800 text-sm">{book.name}</span>
                {expandedBooks[book.id] ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
              </button>

              {expandedBooks[book.id] && chaptersByBook[book.id] && (
                <div className="pl-4 mt-1 space-y-0.5 max-h-80 overflow-y-auto">
                  {chaptersByBook[book.id].map((ch) => (
                    <Link
                      key={ch.id}
                      to={`/chapters/${ch.id}`}
                      className={`flex items-center justify-between p-1.5 text-xs rounded-md hover:bg-primary-light hover:text-white transition-colors ${
                        location.pathname === `/chapters/${ch.id}` ? 'bg-primary text-white' : 'text-gray-600'
                      }`}
                    >
                      <span>Cap. {ch.chapter_number}</span>
                      {getChapterIcon(ch)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-8 border-t pt-4">
          <button
            onClick={() => setShowSuggestion(true)}
            className="w-full flex items-center justify-center gap-2 p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors text-sm font-bold"
          >
            <MessageSquare className="w-4 h-4" /> Sugerencias
          </button>
        </div>
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
    </aside>
  );
};

export default Sidebar;
