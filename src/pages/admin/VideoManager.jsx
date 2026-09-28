import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Video, Loader, Save, CheckSquare, Square, Layers, Book } from 'lucide-react';
import { useToast } from '../../components/shared/Toast';

const VideoManager = () => {
  const [mode, setMode] = useState('chapter'); // 'chapter' or 'book'
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState('');
  
  const [selectedChapters, setSelectedChapters] = useState(new Set());
  const [selectedBooks, setSelectedBooks] = useState(new Set());
  
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const booksData = await api.get('/books');
        
        // Fetch chapters for each book
        const booksWithChapters = await Promise.all(
          booksData.map(async (book) => {
            const chapData = await api.get(`/books/${book.id}/chapters`);
            return { ...book, chapters: chapData.chapters || chapData };
          })
        );
        
        setBooks(booksWithChapters);
      } catch (err) {
        console.error(err);
        showToast('Error cargando los libros', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchBooks();
  }, [showToast]);

  const toggleChapter = (chapId) => {
    const newSet = new Set(selectedChapters);
    if (newSet.has(chapId)) newSet.delete(chapId);
    else newSet.add(chapId);
    setSelectedChapters(newSet);
  };

  const toggleBookChapters = (book) => {
    const newSet = new Set(selectedChapters);
    const allSelected = book.chapters.every(c => newSet.has(c.id));
    
    book.chapters.forEach(c => {
      if (allSelected) newSet.delete(c.id);
      else newSet.add(c.id);
    });
    
    setSelectedChapters(newSet);
  };

  const toggleMainBook = (bookId) => {
    const newSet = new Set(selectedBooks);
    if (newSet.has(bookId)) newSet.delete(bookId);
    else newSet.add(bookId);
    setSelectedBooks(newSet);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoUrl) {
      showToast('Ingresa un enlace de video', 'warning');
      return;
    }
    
    if (mode === 'chapter') {
      if (selectedChapters.size === 0) {
        showToast('Selecciona al menos un capítulo', 'warning');
        return;
      }
      setSaving(true);
      try {
        await api.post('/admin/chapter-videos', {
          videoUrl,
          chapterIds: Array.from(selectedChapters)
        });
        showToast('Video asignado a capítulos exitosamente', 'success');
        setVideoUrl('');
        setSelectedChapters(new Set());
      } catch (err) {
        console.error(err);
        showToast('Error al asignar el video', 'error');
      } finally {
        setSaving(false);
      }
    } else {
      if (selectedBooks.size === 0) {
        showToast('Selecciona al menos un libro', 'warning');
        return;
      }
      setSaving(true);
      try {
        await api.post('/admin/book-videos', {
          videoUrl,
          bookIds: Array.from(selectedBooks)
        });
        showToast('Video asignado a libros exitosamente', 'success');
        setVideoUrl('');
        setSelectedBooks(new Set());
      } catch (err) {
        console.error(err);
        showToast('Error al asignar el video', 'error');
      } finally {
        setSaving(false);
      }
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader className="w-8 h-8 animate-spin text-gold" /></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-[Cinzel] text-3xl font-bold text-primary flex items-center gap-2">
          <Video className="w-8 h-8 text-red-600" /> Gestor de Videos
        </h1>
        <p className="text-gray-600 mt-2">
          Asigna un enlace de video para que aparezca en el foro de los capítulos o como video principal de un libro completo.
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setMode('chapter')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${
            mode === 'chapter' ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-500 border hover:bg-gray-50'
          }`}
        >
          <Layers className="w-5 h-5" /> Video por Capítulos
        </button>
        <button
          onClick={() => setMode('book')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${
            mode === 'book' ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-500 border hover:bg-gray-50'
          }`}
        >
          <Book className="w-5 h-5" /> Video por Libro Completo (Main)
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 border mb-8 animate-fade-in">
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">Enlace del Video (YouTube, Vimeo, etc.)</label>
          <input 
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Ej: https://www.youtube.com/watch?v=..."
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            required
          />
        </div>

        {mode === 'chapter' ? (
          <div className="mb-6 animate-fade-in">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Selecciona los Capítulos</h3>
            <div className="space-y-4">
              {books.map(book => {
                const allSelected = book.chapters.every(c => selectedChapters.has(c.id));
                const someSelected = book.chapters.some(c => selectedChapters.has(c.id));
                
                return (
                  <div key={book.id} className="border rounded-lg overflow-hidden">
                    <div 
                      className="bg-gray-50 p-3 flex items-center justify-between cursor-pointer border-b hover:bg-gray-100"
                      onClick={() => toggleBookChapters(book)}
                    >
                      <span className="font-bold text-primary">{book.name}</span>
                      <button type="button" className="text-primary flex items-center gap-2">
                        {allSelected ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className={`w-5 h-5 ${someSelected ? 'text-primary opacity-50' : 'text-gray-400'}`} />}
                        <span className="text-sm">Seleccionar Todos</span>
                      </button>
                    </div>
                    
                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {book.chapters.map(chap => {
                        const isSelected = selectedChapters.has(chap.id);
                        return (
                          <div 
                            key={chap.id}
                            onClick={() => toggleChapter(chap.id)}
                            className={`p-2 border rounded text-center text-sm cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            Cap. {chap.chapter_number}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mb-6 animate-fade-in">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Selecciona los Libros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {books.map(book => {
                const isSelected = selectedBooks.has(book.id);
                return (
                  <div 
                    key={book.id}
                    onClick={() => toggleMainBook(book.id)}
                    className={`p-4 border-2 rounded-xl cursor-pointer flex justify-between items-center transition-all ${
                      isSelected ? 'border-primary bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div>
                      <h4 className="font-[Cinzel] font-bold text-lg text-primary">{book.name}</h4>
                      <p className="text-xs text-gray-500">{book.chapters.length} capítulos</p>
                    </div>
                    {isSelected ? <CheckSquare className="w-6 h-6 text-primary" /> : <Square className="w-6 h-6 text-gray-300" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button 
            type="submit" 
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {mode === 'chapter' 
              ? `Guardar en Capítulos (${selectedChapters.size})` 
              : `Guardar en Libros (${selectedBooks.size})`
            }
          </button>
        </div>
      </form>
    </div>
  );
};

export default VideoManager;
