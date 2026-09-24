import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { api } from '../utils/api';
import { BookOpen, FileText, History, Loader, Save, ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const ChapterPage = () => {
  const { chapterId } = useParams();
  const { isAdmin } = useAuth();
  const [chapter, setChapter] = useState(null);
  const [history, setHistory] = useState([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [historyData, noteData] = await Promise.all([
          api.get(`/quiz/history/${chapterId}`).catch(() => []),
          api.get(`/notes/${chapterId}`).catch(() => null),
        ]);
        setHistory(historyData);
        if (noteData?.content) setNote(noteData.content);

        // Get chapter info from books
        const books = await api.get('/books');
        for (const book of books) {
          const chaptersData = await api.get(`/books/${book.id}/chapters`);
          const chapters = chaptersData.chapters || chaptersData;
          const found = chapters.find(c => c.id === parseInt(chapterId));
          if (found) {
            setChapter({ ...found, bookName: book.name });
            break;
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [chapterId]);

  const saveNote = async () => {
    setSaving(true);
    try {
      await api.post(`/notes/${chapterId}`, { content: note });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  const bestScore = history.length > 0 ? Math.max(...history.map(h => h.score)) : null;
  const avgScore = history.length > 0 ? Math.round(history.reduce((sum, h) => sum + h.score, 0) / history.length) : null;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">{chapter?.bookName}</p>
        <h1 className="font-[Cinzel] text-3xl font-bold text-primary mb-2">
          Capítulo {chapter?.chapter_number}
        </h1>
        <p className="text-gray-600">{chapter?.title}</p>
      </div>

      {/* Admin Panel */}
      {isAdmin && (
        <div className="bg-red-50 border-l-4 border-danger rounded-r-xl p-4 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm gap-4">
          <div>
            <h3 className="font-[Cinzel] text-lg font-bold text-danger flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Acciones de Administrador
            </h3>
            <p className="text-sm text-red-700 mt-1">Gestiona o edita las preguntas de este capítulo directamente.</p>
          </div>
          <Link
            to={`/admin/questions/${chapterId}`}
            className="flex items-center gap-2 px-5 py-2 bg-danger text-white rounded-lg font-medium hover:bg-red-700 transition-colors shrink-0"
          >
            Gestor de Preguntas
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg p-4 shadow-sm border text-center">
          <div className="text-2xl font-bold text-primary">{history.length}</div>
          <div className="text-sm text-gray-500">Intentos</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border text-center">
          <div className="text-2xl font-bold text-success">{bestScore != null ? `${bestScore}%` : '—'}</div>
          <div className="text-sm text-gray-500">Mejor Nota</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border text-center">
          <div className="text-2xl font-bold text-gold">{avgScore != null ? `${avgScore}%` : '—'}</div>
          <div className="text-sm text-gray-500">Promedio</div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link
          to={`/quiz/${chapterId}`}
          className="flex items-center justify-center gap-2 p-6 bg-gold text-white rounded-xl text-lg font-bold hover:bg-gold-dark transition-colors shadow-md"
        >
          <FileText className="w-6 h-6" /> Iniciar Quiz
        </Link>
        <Link
          to={`/flashcards/${chapterId}`}
          className="flex items-center justify-center gap-2 p-6 bg-primary text-white rounded-xl text-lg font-bold hover:bg-primary-light transition-colors shadow-md"
        >
          <BookOpen className="w-6 h-6" /> Ver Flashcards
        </Link>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl p-6 shadow-sm border mb-8">
        <h3 className="font-[Cinzel] text-lg font-bold text-primary mb-4">📝 Mis Notas</h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Escribe tus notas sobre este capítulo..."
          className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gold"
        />
        <button
          onClick={saveNote}
          disabled={saving}
          className="mt-2 flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary-light disabled:opacity-50 text-sm"
        >
          <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Nota'}
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="font-[Cinzel] text-lg font-bold text-primary mb-4 flex items-center gap-2">
            <History className="w-5 h-5" /> Historial de Intentos
          </h3>
          <div className="space-y-2">
            {history.map((attempt, i) => (
              <div key={attempt.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">
                  Intento #{history.length - i}
                </span>
                <div className="flex items-center gap-4">
                  <span className={`font-bold ${attempt.score >= 80 ? 'text-success' : attempt.score >= 60 ? 'text-warning' : 'text-danger'}`}>
                    {attempt.score}%
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(attempt.completed_at).toLocaleDateString('es')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChapterPage;
