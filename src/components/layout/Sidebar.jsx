import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { ChevronDown, ChevronRight, Book, CheckCircle, Clock, Circle, Trophy } from 'lucide-react';
import { api } from '../../utils/api';

const Sidebar = () => {
  const [books, setBooks] = useState([]);
  const [expandedBooks, setExpandedBooks] = useState({});
  const [chaptersByBook, setChaptersByBook] = useState({});
  const location = useLocation();

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
        {/* Enlace destacado al Simulacro */}
        <Link
          to="/simulacro"
          className="mb-5 w-full flex items-center gap-2.5 p-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-yellow-500/20 to-amber-500/10 border-2 border-amber-500/40 text-amber-950 font-bold text-sm hover:border-amber-500 hover:shadow-md transition-all group block"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center text-sm shadow font-black shrink-0">
              🏆
            </div>
            <div className="truncate flex-1">
              <div className="flex items-center gap-1.5">
                <span className="block truncate font-black text-amber-900 text-xs">Simulacro Oficial</span>
                <span className="text-[9px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-full font-extrabold uppercase">
                  Nuevo
                </span>
              </div>
              <span className="block text-[10px] text-amber-700 font-medium">4 Categorías NTV</span>
            </div>
          </div>
        </Link>

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
      </div>
    </aside>
  );
};

export default Sidebar;
