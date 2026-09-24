import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Loader } from 'lucide-react';

const CustomQuizBuilder = ({ onGenerate }) => {
  const [books, setBooks] = useState([]);
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [questionCount, setQuestionCount] = useState(20);
  const [difficulty, setDifficulty] = useState('mixto');
  const [timeLimit, setTimeLimit] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const data = await api.get('/books');
        setBooks(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBooks();
  }, []);

  const toggleBook = (bookId) => {
    setSelectedBooks(prev =>
      prev.includes(bookId) ? prev.filter(id => id !== bookId) : [...prev, bookId]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedBooks.length === 0) {
      alert('Selecciona al menos un libro.');
      return;
    }
    onGenerate({
      bookIds: selectedBooks,
      questionCount,
      difficulty,
      timeLimit: timeLimit || null,
    });
  };

  if (loading) {
    return <Loader className="w-8 h-8 animate-spin text-gold mx-auto" />;
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-8 border">
      {/* Book Selection */}
      <div className="mb-8">
        <h3 className="font-[Cinzel] text-lg font-bold text-primary mb-4">📖 Selecciona Libros</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {books.map(book => (
            <button
              key={book.id}
              type="button"
              onClick={() => toggleBook(book.id)}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                selectedBooks.includes(book.id)
                  ? 'border-gold bg-gold/10 text-primary font-bold'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">{book.name}</div>
              <div className="text-xs mt-1">{book.chapters_count} caps</div>
            </button>
          ))}
        </div>
      </div>

      {/* Question Count */}
      <div className="mb-8">
        <h3 className="font-[Cinzel] text-lg font-bold text-primary mb-4">🔢 Cantidad de Preguntas</h3>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={questionCount}
            onChange={(e) => setQuestionCount(parseInt(e.target.value))}
            className="flex-1 accent-gold"
          />
          <span className="w-16 text-center text-2xl font-bold text-primary">{questionCount}</span>
        </div>
      </div>

      {/* Difficulty */}
      <div className="mb-8">
        <h3 className="font-[Cinzel] text-lg font-bold text-primary mb-4">⚡ Dificultad</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { value: 'fácil', label: 'Fácil', emoji: '😊' },
            { value: 'medio', label: 'Medio', emoji: '🤔' },
            { value: 'difícil', label: 'Difícil', emoji: '😤' },
            { value: 'mixto', label: 'Mixto', emoji: '🎲' },
          ].map(({ value, label, emoji }) => (
            <button
              key={value}
              type="button"
              onClick={() => setDifficulty(value)}
              className={`p-3 rounded-lg border-2 transition-all ${
                difficulty === value
                  ? 'border-gold bg-gold/10 font-bold'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            >
              <div className="text-xl">{emoji}</div>
              <div className="text-sm mt-1">{label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Time Limit */}
      <div className="mb-8">
        <h3 className="font-[Cinzel] text-lg font-bold text-primary mb-4">⏱️ Tiempo Límite</h3>
        <select
          value={timeLimit}
          onChange={(e) => setTimeLimit(parseInt(e.target.value))}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold focus:outline-none"
        >
          <option value={0}>Sin límite</option>
          <option value={5}>5 minutos</option>
          <option value={10}>10 minutos</option>
          <option value={15}>15 minutos</option>
          <option value={30}>30 minutos</option>
          <option value={60}>60 minutos</option>
        </select>
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full py-4 bg-gold text-white rounded-xl text-lg font-bold hover:bg-gold-dark transition-colors shadow-md"
      >
        🚀 Generar Quiz Personalizado
      </button>
    </form>
  );
};

export default CustomQuizBuilder;
