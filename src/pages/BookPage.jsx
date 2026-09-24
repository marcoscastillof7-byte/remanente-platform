import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { api } from '../utils/api';
import { BookOpen, CheckCircle, Clock, Circle, Loader } from 'lucide-react';

const BookPage = () => {
  const { bookId } = useParams();
  const [chapters, setChapters] = useState([]);
  const [bookName, setBookName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChapters = async () => {
      try {
        const data = await api.get(`/books/${bookId}/chapters`);
        setChapters(data.chapters || data);
        setBookName(data.bookName || `Libro ${bookId}`);
      } catch (err) {
        console.error('Error cargando capítulos:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchChapters();
  }, [bookId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  const getStatusIcon = (chapter) => {
    if (chapter.best_score >= 80) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (chapter.attempts > 0) return <Clock className="w-5 h-5 text-yellow-500" />;
    return <Circle className="w-5 h-5 text-gray-300" />;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-[Cinzel] text-3xl font-bold text-primary mb-2 flex items-center">
          <BookOpen className="w-8 h-8 mr-3 text-gold" />
          {bookName}
        </h1>
        <p className="text-gray-600">Selecciona un capítulo para comenzar tu estudio.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {chapters.map((chapter) => (
          <div key={chapter.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-[Cinzel] font-bold text-xl text-primary-dark">
                Capítulo {chapter.chapter_number}
              </h3>
              {getStatusIcon(chapter)}
            </div>

            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{chapter.title}</p>

            {chapter.best_score != null && chapter.best_score > 0 && (
              <div className="mb-4 text-sm">
                <span className="text-gray-500">Mejor Puntuación: </span>
                <span className="font-bold text-primary">{chapter.best_score}%</span>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Link
                to={`/chapters/${chapter.id}`}
                className="flex-1 text-center py-2 bg-primary text-white rounded hover:bg-primary-light text-sm transition-colors"
              >
                Detalles
              </Link>
              <Link
                to={`/quiz/${chapter.id}`}
                className="flex-1 text-center py-2 bg-gold text-white rounded hover:bg-gold-dark text-sm transition-colors"
              >
                Quiz
              </Link>
              <Link
                to={`/flashcards/${chapter.id}`}
                className="flex-1 text-center py-2 bg-primary-light text-white rounded hover:bg-primary text-sm transition-colors"
              >
                Tarjetas
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BookPage;
