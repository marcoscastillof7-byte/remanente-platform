import { useState, useEffect } from 'react';
import { 
  X, 
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
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfUploadError, setPdfUploadError] = useState('');
  const [pdfUploadSuccess, setPdfUploadSuccess] = useState(false);
  
  // Preguntas e Importador Masivo (Método de Quizzes Oficial)
  const [questions, setQuestions] = useState([]);
  const [bulkText, setBulkText] = useState('');
  const [importMode, setImportMode] = useState('append'); // 'append' | 'replace'
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState('');
  const [bulkErrorMessage, setBulkErrorMessage] = useState('');
  const [loadingBank, setLoadingBank] = useState(false);

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
      const booksList = Array.isArray(data) ? data : (data?.books || []);
      setBooks(booksList);
      if (booksList && booksList.length > 0) {
        handleBookSelect(booksList[0].id, booksList);
      }
    } catch (err) {
      console.error('Error cargando libros:', err);
      setBooks([]);
    }
  };

  const handleBookSelect = async (bookId, booksList = books) => {
    setSelectedBookId(bookId);
    setSelectedChapterIds([]);
    try {
      const data = await api.get(`/books/${bookId}/chapters`);
      // /books/:bookId/chapters devuelve { bookName, videoUrl, chapters: [...] }
      const chaps = Array.isArray(data) ? data : (data?.chapters || []);
      setChapters(chaps);
      if (chaps && chaps.length > 0) {
        setSelectedChapterIds([chaps[0].id]);
      }
    } catch (err) {
      console.error('Error cargando capítulos:', err);
      setChapters([]);
    }
  };

  const toggleChapter = (chapterId) => {
    setSelectedChapterIds(prev => 
      (prev || []).includes(chapterId) ? prev.filter(id => id !== chapterId) : [...(prev || []), chapterId]
    );
  };

  // Manejo de archivo PDF con subida directa a la nube segura (Supabase Storage)
  const handlePdfFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Por favor selecciona un archivo PDF válido (.pdf).');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('El archivo es demasiado grande. El límite máximo es de 50MB.');
      return;
    }

    setPdfFileName(file.name);
    setPdfUploading(true);
    setPdfUploadError('');
    setPdfUploadSuccess(false);

    try {
      // 1. Solicitar URL firmada de subida directa a Supabase Storage (evita límites y caídas)
      const res = await api.post('/meetings/signed-upload-url', {
        fileName: file.name
      });

      if (res && res.signedUrl) {
        // Subida directa por PUT a la nube de Supabase
        const uploadRes = await fetch(res.signedUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': 'application/pdf'
          }
        });

        if (uploadRes.ok) {
          setPdfUrl(res.publicUrl);
          setPdfUploadSuccess(true);
          return;
        }
      }

      // 2. Si la subida directa falló, intentar fallback a través de upload-pdf
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const fallbackRes = await api.post('/meetings/upload-pdf', {
            fileName: file.name,
            fileBase64: reader.result
          });

          if (fallbackRes && fallbackRes.publicUrl) {
            setPdfUrl(fallbackRes.publicUrl);
            setPdfUploadSuccess(true);
          } else {
            throw new Error('No se recibió la URL del documento');
          }
        } catch (fbErr) {
          console.error('Error en fallback upload:', fbErr);
          setPdfUploadError('No se pudo subir el archivo a la nube. Intenta pegando un enlace web directo.');
        }
      };
      reader.readAsDataURL(file);

    } catch (err) {
      console.error('Error subiendo PDF a la nube:', err);
      // Fallback final: leer como data URL
      const reader = new FileReader();
      reader.onload = () => {
        setPdfUrl(reader.result);
        setPdfUploadSuccess(true);
      };
      reader.readAsDataURL(file);
    } finally {
      setPdfUploading(false);
    }
  };

  // Parseador de preguntas idéntico al método de quizzes de la plataforma principal
  const parseQuestionsFromText = (rawText) => {
    if (!rawText.trim()) return [];

    const blocks = rawText
      .split(/(?:^|\n)(?=PREGUNTA\s*[:\-\d]|(?:\d+[\.\)]\s+))/i)
      .map(b => b.trim())
      .filter(b => b.length > 0);

    const parsed = [];

    for (let block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) continue;

      let question_text = '';
      let option_a = '';
      let option_b = '';
      let option_c = '';
      let option_d = '';
      let correct_answer = 'a';
      let explanation = '';
      let verse_reference = '';

      for (let line of lines) {
        // Coincidir con título de pregunta
        const matchQ = line.match(/^(?:PREGUNTA\s*[:\-\d]*\s*|\d+[\.\)]\s*)(.+)$/i);
        if (matchQ && !question_text) {
          question_text = matchQ[1].trim();
          continue;
        }

        // Coincidir con opciones
        const matchA = line.match(/^[A]\s*[.)\-:]\s*(.+)$/i);
        const matchB = line.match(/^[B]\s*[.)\-:]\s*(.+)$/i);
        const matchC = line.match(/^[C]\s*[.)\-:]\s*(.+)$/i);
        const matchD = line.match(/^[D]\s*[.)\-:]\s*(.+)$/i);

        // Coincidir con metadatos
        const matchResp = line.match(/^RESPUESTA(?:\s*CORRECTA)?\s*[:\-]?\s*([A-D])/i);
        const matchExp = line.match(/^EXPLICACI[OÓ]N\s*[:\-]?\s*(.+)$/i);
        const matchVer = line.match(/^VERS[IÍ]CULO\s*[:\-]?\s*(.+)$/i);

        if (matchA) option_a = matchA[1].trim();
        else if (matchB) option_b = matchB[1].trim();
        else if (matchC) option_c = matchC[1].trim();
        else if (matchD) option_d = matchD[1].trim();
        else if (matchResp) correct_answer = matchResp[1].trim().toLowerCase();
        else if (matchExp) explanation = matchExp[1].trim();
        else if (matchVer) verse_reference = matchVer[1].trim();
        else if (!question_text) {
          question_text = line;
        }
      }

      if (question_text && (option_a || option_b)) {
        parsed.push({
          id: `q_bulk_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          question_text,
          option_a: option_a || 'Opción A',
          option_b: option_b || 'Opción B',
          option_c: option_c || 'Opción C',
          option_d: option_d || 'Opción D',
          correct_answer: correct_answer || 'a',
          explanation: explanation || '',
          verse_reference: verse_reference || '',
          time_limit_seconds: 25
        });
      }
    }

    return parsed;
  };

  // Procesar e importar texto
  const handleProcessBulkImport = () => {
    setBulkSuccessMessage('');
    setBulkErrorMessage('');

    if (!bulkText.trim()) {
      setBulkErrorMessage('Por favor pega el texto de las preguntas o sube un archivo .txt');
      return;
    }

    const parsed = parseQuestionsFromText(bulkText);
    if (parsed.length === 0) {
      setBulkErrorMessage('No se reconocieron preguntas con formato válido. Asegúrate de incluir PREGUNTA:, A., B., C., D., y RESPUESTA:.');
      return;
    }

    if (importMode === 'replace') {
      setQuestions(parsed);
    } else {
      setQuestions(prev => [...prev, ...parsed]);
    }

    setBulkSuccessMessage(`¡${parsed.length} preguntas procesadas e importadas correctamente!`);
    setBulkText('');
  };

  // Subir archivo .txt
  const handleQuestionsTxtUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setBulkText(content);
    };
    reader.readAsText(file);
  };

  // Cargar desde el banco bíblico oficial de los capítulos seleccionados
  const handleLoadFromBank = async () => {
    if (selectedChapterIds.length === 0) {
      alert('Selecciona al menos un capítulo en la sección 2.');
      return;
    }

    setLoadingBank(true);
    setBulkSuccessMessage('');
    setBulkErrorMessage('');

    try {
      const res = await api.post('/meetings/generate-questions', {
        bookId: selectedBookId,
        chapterIds: selectedChapterIds,
        questionCount: 15,
        difficulty: 'medio'
      });

      if (res && res.questions && Array.isArray(res.questions) && res.questions.length > 0) {
        if (importMode === 'replace') {
          setQuestions(res.questions);
        } else {
          setQuestions(prev => [...prev, ...res.questions]);
        }
        setBulkSuccessMessage(`¡${res.questions.length} preguntas bíblicas cargadas desde el banco de estudio!`);
      } else {
        alert('No se encontraron preguntas en el banco para los capítulos seleccionados.');
      }
    } catch (err) {
      console.error(err);
      alert('Error cargando preguntas del banco.');
    } finally {
      setLoadingBank(false);
    }
  };

  // Plantilla de ejemplo idéntica al formato de la plataforma
  const insertTemplateExample = () => {
    const template = `PREGUNTA: ¿Quién fue el primer rey ungido de Israel?
A. David
B. Saúl
C. Salomón
D. Samuel
RESPUESTA: B
EXPLICACION: Saúl, hijo de Cis de la tribu de Benjamín, fue ungido por Samuel.
VERSICULO: 1 Samuel 10:1

PREGUNTA: ¿Con qué derrotó David a Goliat en el valle de Ela?
A. Una espada de bronce
B. Una lanza y escudo
C. Una honda y una piedra
D. Un arco y flechas
RESPUESTA: C
EXPLICACION: David confió en el Dios de Israel y con su honda hirió a Goliat en la frente.
VERSICULO: 1 Samuel 17:49`;

    setBulkText(template);
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

    if (pdfUploading) {
      setError('Por favor espera a que termine de subirse el archivo PDF a la nube.');
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

  const selectedBook = (books || []).find(b => String(b.id) === String(selectedBookId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gold/40 w-full max-w-3xl my-2 sm:my-8 overflow-hidden flex flex-col max-h-[95dvh] sm:max-h-[90vh]">
        
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-primary-dark via-primary to-primary-dark text-white p-4 sm:p-6 border-b border-gold/40 flex justify-between items-center shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-gold/20 text-gold-light border border-gold/30 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-1">
              <Radio className="w-3.5 h-3.5 animate-pulse text-gold" />
              Panel de Líder / Admin
            </div>
            <h2 className="font-[Cinzel] text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              📖 Crear Nuevo Remanente Meet
            </h2>
            <p className="text-[11px] sm:text-xs text-gray-200 mt-0.5">
              Configura la lectura compartida de PDF y las preguntas en vivo para la congregación.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-300 hover:text-white p-1.5 sm:p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Formulario con Scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1">
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
                {(books || []).map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.chapters_count} Capítulos)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                Capítulos a Tratar ({(selectedChapterIds || []).length} seleccionados)
              </label>
              <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-2.5 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 bg-gray-50">
                {(Array.isArray(chapters) ? chapters : []).map(c => {
                  const isChecked = (selectedChapterIds || []).includes(c.id);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => toggleChapter(c.id)}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-md border text-center transition-all cursor-pointer ${
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
                {pdfUploading ? (
                  <div className="border-2 border-dashed border-gold rounded-xl p-6 flex flex-col items-center justify-center bg-gold/5 space-y-2">
                    <Loader className="w-8 h-8 text-gold animate-spin" />
                    <span className="text-xs font-bold text-gray-800">
                      Subiendo "{pdfFileName}" a la nube segura...
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Por favor espera un momento mientras se optimiza el archivo.
                    </span>
                  </div>
                ) : pdfUploadSuccess && pdfUrl ? (
                  <div className="border border-green-300 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-green-50/70">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-green-900 truncate max-w-xs">{pdfFileName}</h4>
                        <p className="text-[11px] text-green-700">✓ Documento PDF subido exitosamente a la nube</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setPdfUrl(''); setPdfFileName(''); setPdfUploadSuccess(false); }}
                      className="text-xs text-red-600 hover:text-red-700 hover:underline font-semibold shrink-0 cursor-pointer"
                    >
                      Cambiar Archivo
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-300 hover:border-gold rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50 hover:bg-gold/5 group">
                    <Upload className="w-8 h-8 text-gold mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-gray-700">
                      {pdfFileName || 'Haz clic para seleccionar tu archivo PDF'}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">Formato .PDF (Máx 50MB)</span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={handlePdfFileUpload}
                      className="sr-only"
                    />
                  </label>
                )}

                {pdfUploadError && (
                  <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{pdfUploadError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Importador Masivo y Gestión de Preguntas */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-1">
              <h3 className="text-base font-bold text-primary font-[Cinzel] flex items-center gap-2">
                <span>4. Preguntas para el Meet</span>
                <span className="text-xs bg-gold/20 text-gold-dark px-2 py-0.5 rounded-full font-bold">
                  {questions.length} configuradas
                </span>
              </h3>
              <button
                type="button"
                onClick={handleAddManualQuestion}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Manual
              </button>
            </div>

            {/* Panel de Importación Masiva (Método Estándar de la Plataforma) */}
            <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200 rounded-xl p-4 space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Importador Masivo de Preguntas</span>
                </div>

                {/* Acciones rápidas: Subir TXT, Plantilla, Cargar del Banco */}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold bg-white border border-gray-300 hover:border-gold px-2.5 py-1 rounded shadow-2xs text-gray-700 hover:text-gold-dark transition-all">
                    <Upload className="w-3 h-3 text-gold" />
                    <span>Subir archivo .txt</span>
                    <input 
                      type="file" 
                      accept=".txt,text/plain" 
                      onChange={handleQuestionsTxtUpload} 
                      className="hidden" 
                    />
                  </label>

                  <button
                    type="button"
                    onClick={insertTemplateExample}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white border border-gray-300 hover:border-blue-400 px-2.5 py-1 rounded shadow-2xs text-gray-700 hover:text-blue-700 transition-all"
                  >
                    <span>Plantilla Ejemplo 📝</span>
                  </button>

                  <button
                    type="button"
                    disabled={loadingBank || selectedChapterIds.length === 0}
                    onClick={handleLoadFromBank}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100/80 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded shadow-2xs text-amber-900 transition-all disabled:opacity-50"
                    title="Carga preguntas oficiales de los capítulos seleccionados"
                  >
                    {loadingBank ? (
                      <>
                        <Loader className="w-3 h-3 animate-spin text-amber-800" />
                        <span>Cargando...</span>
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-3 h-3 text-amber-800" />
                        <span>Cargar del Banco 🏛️</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Textarea para pegar las preguntas */}
              <div>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={4}
                  placeholder={`Pega tus preguntas con el formato estándar de la plataforma:\n\nPREGUNTA: ¿Texto de la pregunta?\nA. Opción A\nB. Opción B\nC. Opción C\nD. Opción D\nRESPUESTA: B\nEXPLICACION: Explicación bíblica (opcional)\nVERSICULO: 1 Samuel 16:7 (opcional)`}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg text-xs font-mono bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Opciones y Botón de Procesar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-blue-100">
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-gray-700">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Añadir a las existentes</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-red-600 font-medium">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span>Reemplazar preguntas</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleProcessBulkImport}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Procesar e Importar Preguntas</span>
                </button>
              </div>

              {/* Mensajes de éxito / error */}
              {bulkSuccessMessage && (
                <div className="text-xs text-green-700 bg-green-50 border border-green-200 p-2.5 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  <span>{bulkSuccessMessage}</span>
                </div>
              )}

              {bulkErrorMessage && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{bulkErrorMessage}</span>
                </div>
              )}
            </div>

            {/* Lista de Preguntas Previsualizadas */}
            {Array.isArray(questions) && questions.length > 0 && (
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
        <div className="bg-gray-50 p-3 sm:p-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-700 hover:bg-gray-100 transition-colors font-medium text-center"
          >
            Cancelar
          </button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(false)}
              className="w-full sm:w-auto px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 text-center"
            >
              Guardar y Programar
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white rounded-lg text-xs sm:text-sm font-bold shadow-md transition-all disabled:opacity-50 text-center"
            >
              <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
              <span>Guardar e Iniciar en Vivo 🚀</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CreateMeetModal;
