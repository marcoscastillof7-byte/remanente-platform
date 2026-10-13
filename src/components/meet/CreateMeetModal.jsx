import { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Upload, 
  FileText, 
  BookOpen, 
  Plus, 
  Trash2, 
  Loader, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  Radio
} from 'lucide-react';
import { api } from '../../utils/api';

const CreateMeetModal = ({ isOpen, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [descriptionText, setDescriptionText] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [books, setBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [chapters, setChapters] = useState([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState([]);
  
  // PDF
  const [pdfMode, setPdfMode] = useState('url'); // 'url' | 'upload'
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfFileName, setPdfFileName] = useState('');
  
  // Preguntas
  const [questions, setQuestions] = useState([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState('medio');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState('');

  // Envío
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadBooks();
      // Fecha predeterminada: hoy + 1 hora
      const nextHour = new Date(Date.now() + 60 * 60 * 1000);
      setScheduledFor(nextHour.toISOString().slice(0, 16));
    }
  }, [isOpen]);

  const loadBooks = async () => {
    try {
      const data = await api.get('/books');
      setBooks(data || []);
      if (data && data.length > 0) {
        handleBookSelect(data[0].id, data);
      }
    } catch (err) {
      console.error('Error cargando libros:', err);
    }
  };

  const handleBookSelect = async (bookId, booksList = books) => {
    setSelectedBookId(bookId);
    setSelectedChapterIds([]);
    try {
      const data = await api.get(`/books/${bookId}/chapters`);
      setChapters(data || []);
      if (data && data.length > 0) {
        setSelectedChapterIds([data[0].id]);
      }
    } catch (err) {
      console.error('Error cargando capítulos:', err);
    }
  };

  const toggleChapter = (chapterId) => {
    setSelectedChapterIds(prev => 
      prev.includes(chapterId) ? prev.filter(id => id !== chapterId) : [...prev, chapterId]
    );
  };

  // Manejo de archivo PDF
  const handlePdfFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Por favor selecciona un archivo PDF válido.');
      return;
    }

    setPdfFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPdfUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Generar preguntas con IA
  const handleGenerateAI = async () => {
    if (selectedChapterIds.length === 0) {
      alert('Selecciona al menos un capítulo para generar preguntas acordes al estudio.');
      return;
    }

    setGeneratingAI(true);
    setAiSuccessMessage('');
    setError(null);

    try {
      const res = await api.post('/meetings/generate-questions', {
        bookId: selectedBookId,
        chapterIds: selectedChapterIds,
        customPrompt: aiPrompt,
        questionCount: parseInt(questionCount, 10),
        difficulty
      });

      if (res && res.questions && res.questions.length > 0) {
        setQuestions(res.questions);
        setAiSuccessMessage(
          res.usedAI 
            ? `¡${res.questions.length} preguntas generadas con Inteligencia Artificial (RV1960)!` 
            : `¡${res.questions.length} preguntas bíblicas verificadas cargadas desde el banco de estudio!`
        );
      } else {
        alert('No se pudieron generar preguntas. Intenta de nuevo.');
      }
    } catch (err) {
      console.error(err);
      alert('Error generando preguntas. Intenta de nuevo.');
    } finally {
      setGeneratingAI(false);
    }
  };

  // Añadir pregunta manual
  const handleAddManualQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        id: `manual_${Date.now()}`,
        question_text: '¿Nueva pregunta?',
        option_a: 'Opción A',
        option_b: 'Opción B',
        option_c: 'Opción C',
        option_d: 'Opción D',
        correct_answer: 'a',
        explanation: 'Explicación del versículo',
        verse_reference: '',
        time_limit_seconds: 25
      }
    ]);
  };

  const handleRemoveQuestion = (idx) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  // Guardar Meet
  const handleSubmit = async (startImmediately = false) => {
    if (!title.trim()) {
      setError('Por favor escribe un título para el Meet.');
      return;
    }

    if (questions.length === 0) {
      if (!confirm('No has agregado preguntas para el meet. ¿Deseas crearlo de todas formas?')) {
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const selectedBook = books.find(b => String(b.id) === String(selectedBookId));
      
      const payload = {
        title,
        descriptionText,
        scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : new Date().toISOString(),
        book_id: selectedBookId,
        book_name: selectedBook?.name || '',
        chapters_selected: selectedChapterIds,
        pdf_url: pdfUrl,
        questions
      };

      const created = await api.post('/meetings', payload);

      if (startImmediately && created?.id) {
        await api.post(`/meetings/${created.id}/start`, {});
      }

      if (onCreated) onCreated(created, startImmediately);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Error al guardar el Meet.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedBook = books.find(b => String(b.id) === String(selectedBookId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gold/40 w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-primary-dark via-primary to-primary-dark text-white p-6 border-b border-gold/40 flex justify-between items-center shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-gold/20 text-gold-light border border-gold/30 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider mb-1">
              <Radio className="w-3.5 h-3.5 animate-pulse text-gold" />
              Panel de Líder / Admin
            </div>
            <h2 className="font-[Cinzel] text-2xl font-bold text-white flex items-center gap-2">
              📖 Crear Nuevo Remanente Meet
            </h2>
            <p className="text-xs text-gray-200 mt-0.5">
              Configura la lectura compartida de PDF y las preguntas en vivo para la congregación.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Formulario con Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Información General */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-primary font-[Cinzel] border-b pb-1">
              1. Información del Estudio
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                  Título del Meet *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Estudio 1 Samuel: La victoria de David"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                  Fecha y Hora Programada
                </label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                Descripción o Enfoque del Estudio
              </label>
              <textarea
                value={descriptionText}
                onChange={(e) => setDescriptionText(e.target.value)}
                rows={2}
                placeholder="Breve resumen de lo que se estudiará hoy..."
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* 2. Selección de Libro y Capítulos */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-primary font-[Cinzel] border-b pb-1">
              2. Libro y Capítulos a Estudiar
            </h3>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                Seleccionar Libro
              </label>
              <select
                value={selectedBookId}
                onChange={(e) => handleBookSelect(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold focus:border-transparent text-sm font-medium"
              >
                {books.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.chapters_count} Capítulos)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                Capítulos a Tratar ({selectedChapterIds.length} seleccionados)
              </label>
              <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-2.5 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 bg-gray-50">
                {chapters.map(c => {
                  const isChecked = selectedChapterIds.includes(c.id);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => toggleChapter(c.id)}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-md border text-center transition-all ${
                        isChecked 
                          ? 'bg-gold text-white border-gold shadow-sm font-bold' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      Cap. {c.chapter_number}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Documento PDF */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-primary font-[Cinzel] border-b pb-1">
              3. Documento PDF para Lectura Compartida
            </h3>

            <div className="flex gap-4 border-b border-gray-100 pb-2">
              <button
                type="button"
                onClick={() => setPdfMode('url')}
                className={`text-xs font-bold uppercase tracking-wider pb-1 border-b-2 transition-all ${
                  pdfMode === 'url' ? 'border-gold text-primary font-bold' : 'border-transparent text-gray-500'
                }`}
              >
                Enlace / URL de PDF
              </button>
              <button
                type="button"
                onClick={() => setPdfMode('upload')}
                className={`text-xs font-bold uppercase tracking-wider pb-1 border-b-2 transition-all ${
                  pdfMode === 'upload' ? 'border-gold text-primary font-bold' : 'border-transparent text-gray-500'
                }`}
              >
                Subir Archivo desde mi Dispositivo
              </button>
            </div>

            {pdfMode === 'url' ? (
              <div>
                <input
                  type="url"
                  value={pdfUrl}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  placeholder="https://ejemplo.com/estudio-biblico.pdf"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold focus:border-transparent text-sm"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Pega un enlace público a cualquier documento PDF (Google Drive público, Supabase o enlace web).
                </p>
              </div>
            ) : (
              <div>
                <label className="border-2 border-dashed border-gray-300 hover:border-gold rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50">
                  <Upload className="w-8 h-8 text-gold mb-1" />
                  <span className="text-xs font-bold text-gray-700">
                    {pdfFileName || 'Haz clic para seleccionar un archivo PDF'}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5">Formato .PDF (Máx 25MB)</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>
            )}
          </div>

          {/* 4. Preguntas para el Meet (IA y Prompt) */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-1">
              <h3 className="text-base font-bold text-primary font-[Cinzel]">
                4. Preguntas del Meet ({questions.length} configuradas)
              </h3>
              <button
                type="button"
                onClick={handleAddManualQuestion}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Manual
              </button>
            </div>

            {/* Generador de IA */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-gold" />
                <span>Generador de Preguntas con IA (Prompt Inteligente)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-800 mb-1">
                  Instrucción / Prompt especial para las preguntas (Opcional):
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={2}
                  placeholder="Ej: 'Enfócate en la lealtad entre Jonatán y David y el cántico del arco en 2 Samuel 1'..."
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-gold focus:border-transparent"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <span className="text-[11px] font-bold text-amber-800 block mb-0.5">Cantidad:</span>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                    className="text-xs px-2.5 py-1.5 border border-amber-300 rounded-md bg-white font-medium"
                  >
                    <option value={5}>5 Preguntas</option>
                    <option value={10}>10 Preguntas</option>
                    <option value={15}>15 Preguntas</option>
                  </select>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-amber-800 block mb-0.5">Dificultad:</span>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="text-xs px-2.5 py-1.5 border border-amber-300 rounded-md bg-white font-medium"
                  >
                    <option value="fácil">Fácil</option>
                    <option value="medio">Medio</option>
                    <option value="difícil">Difícil</option>
                  </select>
                </div>

                <div className="flex-1 flex justify-end items-end pt-3 sm:pt-0">
                  <button
                    type="button"
                    disabled={generatingAI}
                    onClick={handleGenerateAI}
                    className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all disabled:opacity-50"
                  >
                    {generatingAI ? (
                      <>
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                        <span>Generando con IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>✨ Generar Preguntas Ahora</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {aiSuccessMessage && (
                <div className="text-xs text-green-700 bg-green-50 border border-green-200 p-2.5 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  <span>{aiSuccessMessage}</span>
                </div>
              )}
            </div>

            {/* Lista de Preguntas Previsualizadas */}
            {questions.length > 0 && (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {questions.map((q, idx) => (
                  <div key={idx} className="p-3 border border-gray-200 rounded-lg bg-white shadow-xs relative group">
                    <div className="flex justify-between items-start gap-2">
                      <div className="font-semibold text-xs text-gray-800 flex items-center gap-1.5">
                        <span className="w-5 h-5 bg-gold/20 text-gold-dark rounded-full flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <span>{q.question_text}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(idx)}
                        className="text-gray-400 hover:text-red-500 p-1"
                        title="Eliminar pregunta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 mt-2 text-[11px]">
                      <div className={`p-1.5 rounded border ${q.correct_answer === 'a' ? 'bg-green-50 border-green-300 font-bold text-green-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                        A) {q.option_a}
                      </div>
                      <div className={`p-1.5 rounded border ${q.correct_answer === 'b' ? 'bg-green-50 border-green-300 font-bold text-green-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                        B) {q.option_b}
                      </div>
                      <div className={`p-1.5 rounded border ${q.correct_answer === 'c' ? 'bg-green-50 border-green-300 font-bold text-green-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                        C) {q.option_c}
                      </div>
                      <div className={`p-1.5 rounded border ${q.correct_answer === 'd' ? 'bg-green-50 border-green-300 font-bold text-green-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                        D) {q.option_d}
                      </div>
                    </div>

                    {q.verse_reference && (
                      <p className="text-[10px] text-gray-500 mt-1.5 italic">
                        Cita: {q.verse_reference}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pie del Modal */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex flex-wrap justify-between items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors font-medium"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(false)}
              className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Guardar y Programar
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white rounded-lg text-sm font-bold shadow-md transition-all disabled:opacity-50"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Guardar e Iniciar en Vivo 🚀</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CreateMeetModal;
