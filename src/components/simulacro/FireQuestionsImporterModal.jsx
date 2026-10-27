import { useState, useEffect, useRef } from 'react';
import { 
  Upload, X, CheckCircle2, AlertCircle, AlertTriangle, FileText, 
  Sparkles, Layers, RefreshCw, Database, Trash2, HelpCircle, Check, BookOpen
} from 'lucide-react';
import { api } from '../../utils/api';

const FIRE_CATEGORIES = [
  { id: 'all', name: 'Todas las Disciplinas / Libros', icon: '🌟', color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10' },
  { id: 'personajes', name: 'Personajes', icon: '👤', color: 'text-blue-400', border: 'border-blue-500/40', bg: 'bg-blue-500/10' },
  { id: 'lugares', name: 'Lugares', icon: '📍', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' },
  { id: 'cantidades', name: 'Cantidades', icon: '🔢', color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10' },
  { id: 'eventos', name: 'Eventos', icon: '⚡', color: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-500/10' }
];

export default function FireQuestionsImporterModal({ isOpen, onClose, onImportSuccess }) {
  // Pestaña activa: 'bulk' (Importador Masivo .txt) | 'form' (Individual Manual)
  const [activeTab, setActiveTab] = useState('bulk');

  // Categoría o Ámbito Seleccionado
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modo de importación: 'append' (agregar) | 'replace' (reemplazar)
  const [importMode, setImportMode] = useState('append');

  // Texto sin procesar
  const [inputText, setInputText] = useState('');

  // Preguntas analizadas y errores
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [errors, setErrors] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');

  // Estados de carga
  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ personajes: 0, lugares: 0, cantidades: 0, eventos: 0, total: 0 });
  const [showInstructions, setShowInstructions] = useState(true);

  const fileInputRef = useRef(null);

  // Formulario manual individual
  const [singleForm, setSingleForm] = useState({
    book_id: '',
    chapter_id: '',
    category: 'personajes',
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'a',
    difficulty: 'medio',
    explanation: '',
    verse_reference: ''
  });

  // Cargar libros, capítulos y estadísticas de preguntas
  useEffect(() => {
    if (isOpen) {
      fetchBooksAndChapters();
      fetchStats();
      setSuccessMsg('');
      setErrors([]);
    }
  }, [isOpen]);

  const fetchBooksAndChapters = async () => {
    setLoadingBooks(true);
    try {
      const data = await api.get('/books');
      if (Array.isArray(data)) {
        const booksWithChapters = await Promise.all(data.map(async (book) => {
          try {
            const response = await api.get(`/books/${book.id}/chapters`);
            return { ...book, chapters: response.chapters || [] };
          } catch (e) {
            return { ...book, chapters: [] };
          }
        }));
        setBooks(booksWithChapters);
        if (booksWithChapters.length > 0 && !singleForm.book_id) {
          setSingleForm(prev => ({
            ...prev,
            book_id: booksWithChapters[0].id,
            chapter_id: booksWithChapters[0].chapters[0]?.id || 1
          }));
        }
      }
    } catch (err) {
      console.warn('Error cargando catálogo de libros para el importador:', err);
    } finally {
      setLoadingBooks(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/simulacro/questions/fire-questions/stats');
      if (res && res.stats) {
        setStats(res.stats);
      }
    } catch (e) {
      console.warn('Error cargando estadísticas:', e);
    }
  };

  // Cargar archivo .txt desde la máquina local
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setInputText(content);
        handleParse(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Parser robusto idéntico al Importador Global Masivo de Quizzes
  const handleParse = (rawText = inputText) => {
    setSuccessMsg('');
    setErrors([]);
    setParsedQuestions([]);

    const textToProcess = (typeof rawText === 'string' ? rawText : inputText).trim();
    if (!textToProcess) {
      setErrors(['Por favor escribe, pega o carga un texto antes de analizar.']);
      return;
    }

    // 1. Detección automática de JSON si viene en ese formato
    if (textToProcess.startsWith('[') || textToProcess.startsWith('{')) {
      try {
        const parsed = JSON.parse(textToProcess);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const validated = list.map((q, idx) => ({
          chapter_id: q.chapter_id || 1,
          bookName: q.bookName || 'Olimpiadas Bíblicas',
          chapterNumber: q.chapterNumber || q.chapter_number || 1,
          category: q.category || selectedCategory,
          question_text: q.question_text || q.pregunta || '',
          option_a: q.option_a || q.a || '',
          option_b: q.option_b || q.b || '',
          option_c: q.option_c || q.c || 'Ninguna de las anteriores',
          option_d: q.option_d || q.d || 'Todas las anteriores',
          correct_answer: (q.correct_answer || q.respuesta || 'a').toLowerCase().trim(),
          explanation: q.explanation || q.explicacion || 'Respuesta bíblica oficial NTV.',
          verse_reference: q.verse_reference || q.versiculo || '',
          difficulty: q.difficulty || 'medio'
        })).filter(q => q.question_text && q.option_a && q.option_b);

        if (validated.length > 0) {
          setParsedQuestions(validated);
          return;
        }
      } catch (e) {}
    }

    // 2. Parser por bloques de texto estándar (LIBRO, CAPITULO, PREGUNTA, A., B., C., D., RESPUESTA)
    const lines = textToProcess.split('\n');
    const result = [];
    const localErrors = [];

    const removeAccents = (str) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    let currentBook = books.length > 0 ? books[0] : null;
    let currentChapterId = currentBook?.chapters?.[0]?.id || 1;
    let currentChapterNum = currentBook?.chapters?.[0]?.chapter_number || 1;
    let currentCategory = selectedCategory !== 'all' ? selectedCategory : 'personajes';
    let currentQ = null;

    const cleanLines = lines.map(l => l.trim()).filter(l => l.length > 0);

    for (let i = 0; i < cleanLines.length; i++) {
      const line = cleanLines[i];

      // Detección de LIBRO:
      const matchLibro = line.match(/^LIBRO\s*[:\-]?\s*(.+)$/i);
      if (matchLibro) {
        const bookName = matchLibro[1].trim();
        const foundBook = books.find(b => removeAccents(b.name.toLowerCase()) === removeAccents(bookName.toLowerCase()));
        if (foundBook) {
          currentBook = foundBook;
          currentChapterId = foundBook.chapters?.[0]?.id || 1;
          currentChapterNum = foundBook.chapters?.[0]?.chapter_number || 1;
        } else {
          localErrors.push(`Línea ${i + 1}: Libro "${bookName}" no encontrado en el sistema. Asegúrate de usar: 1 Samuel, 2 Samuel, 1 Reyes o 2 Reyes.`);
        }
        continue;
      }

      // Detección de CAPITULO:
      const matchCapitulo = line.match(/^CAP[IÍ]TULO\s*[:\-]?\s*(\d+)/i);
      if (matchCapitulo) {
        const chapterNum = parseInt(matchCapitulo[1], 10);
        if (currentBook) {
          const foundChapter = currentBook.chapters?.find(c => c.chapter_number === chapterNum);
          if (foundChapter) {
            currentChapterId = foundChapter.id;
            currentChapterNum = foundChapter.chapter_number;
          } else {
            localErrors.push(`Línea ${i + 1}: Capítulo ${chapterNum} no existe en el libro ${currentBook.name}.`);
          }
        }
        continue;
      }

      // Detección de CATEGORIA: (opcional para clasificar en Fire Questions)
      const matchCategoria = line.match(/^CATEGOR[IÍ]A\s*[:\-]?\s*(.+)$/i);
      if (matchCategoria) {
        const catStr = removeAccents(matchCategoria[1].toLowerCase().trim());
        if (catStr.includes('personaje')) currentCategory = 'personajes';
        else if (catStr.includes('lugar')) currentCategory = 'lugares';
        else if (catStr.includes('cantidad') || catStr.includes('numero')) currentCategory = 'cantidades';
        else if (catStr.includes('evento')) currentCategory = 'eventos';
        continue;
      }

      // Detección de PREGUNTA: (soporta PREGUNTA:, P:, o número 1.)
      const matchPregunta = line.match(/^(?:PREGUNTA|P)\s*[:\-]?\s*(.+)$/i) || line.match(/^(\d+)[\.\-\)]\s+(.+\?.*)$/i);
      if (matchPregunta) {
        // Guardar la pregunta anterior si estaba completa
        if (currentQ) {
          if (!currentQ.option_a || !currentQ.option_b) {
            localErrors.push(`Pregunta incompleta antes de la línea ${i + 1}: "${currentQ.question_text.substring(0, 35)}..." (le faltan opciones).`);
          } else {
            result.push(currentQ);
          }
        }

        const qText = (matchPregunta[1] && matchPregunta[2] ? matchPregunta[2] : matchPregunta[1]).trim();
        currentQ = {
          chapter_id: currentChapterId,
          bookName: currentBook?.name || '1 Samuel',
          chapterNumber: currentChapterNum,
          category: selectedCategory !== 'all' ? selectedCategory : currentCategory,
          question_text: qText,
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
          correct_answer: 'a',
          difficulty: 'medio',
          explanation: '',
          verse_reference: ''
        };
        continue;
      }

      // Opciones y Atributos de la Pregunta en curso
      if (currentQ) {
        // Soporta formatos A., A), A-, A:
        const matchA = line.match(/^[A]\s*[.)\-:]\s*(.+)$/i);
        const matchB = line.match(/^[B]\s*[.)\-:]\s*(.+)$/i);
        const matchC = line.match(/^[C]\s*[.)\-:]\s*(.+)$/i);
        const matchD = line.match(/^[D]\s*[.)\-:]\s*(.+)$/i);
        const matchResp = line.match(/^(?:RESPUESTA|CORRECTA|R)\s*[:\-]?\s*([A-D])/i);
        const matchExp = line.match(/^(?:EXPLICACI[OÓ]N|EXP|NOTA)\s*[:\-]?\s*(.+)$/i);
        const matchVer = line.match(/^(?:VERS[IÍ]CULO|VERSICULO|REF|CITA)\s*[:\-]?\s*(.+)$/i);
        const matchDif = line.match(/^(?:DIFICULTAD|NIVEL)\s*[:\-]?\s*(f[aá]cil|medio|dif[ií]cil)/i);

        if (matchA) currentQ.option_a = matchA[1].trim();
        else if (matchB) currentQ.option_b = matchB[1].trim();
        else if (matchC) currentQ.option_c = matchC[1].trim();
        else if (matchD) currentQ.option_d = matchD[1].trim();
        else if (matchResp) currentQ.correct_answer = matchResp[1].trim().toLowerCase();
        else if (matchExp) currentQ.explanation = matchExp[1].trim();
        else if (matchVer) currentQ.verse_reference = matchVer[1].trim();
        else if (matchDif) currentQ.difficulty = removeAccents(matchDif[1].toLowerCase());
      }
    }

    // Agregar la última pregunta
    if (currentQ) {
      if (!currentQ.option_a || !currentQ.option_b) {
        localErrors.push(`La última pregunta "${currentQ.question_text.substring(0, 35)}..." no tiene opciones A y B válidas.`);
      } else {
        result.push(currentQ);
      }
    }

    if (result.length === 0 && localErrors.length === 0) {
      localErrors.push('No se pudieron reconocer preguntas válidas. Revisa las instrucciones de formato o usa el botón "Cargar archivo .txt".');
    }

    setParsedQuestions(result);
    setErrors(localErrors);
  };

  // Descartar una pregunta individual de la vista previa
  const handleRemoveQuestionFromPreview = (index) => {
    setParsedQuestions(prev => prev.filter((_, idx) => idx !== index));
  };

  // Guardar en la Base de Datos (Supabase)
  const handleSaveToDatabase = async () => {
    if (parsedQuestions.length === 0) return;
    setSubmitting(true);
    setSuccessMsg('');

    try {
      const payloadQuestions = parsedQuestions.map(q => ({
        chapter_id: q.chapter_id || 1,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c || 'Ninguna de las anteriores',
        option_d: q.option_d || 'Todas las anteriores',
        correct_answer: q.correct_answer || 'a',
        difficulty: q.difficulty || 'medio',
        explanation: q.explanation || 'Respuesta bíblica oficial NTV.',
        verse_reference: q.verse_reference || '',
        custom_category: q.category || selectedCategory
      }));

      const res = await api.post('/simulacro/questions/import', {
        category: selectedCategory !== 'all' ? selectedCategory : null,
        questions: payloadQuestions,
        mode: importMode
      });

      if (res && res.success) {
        setSuccessMsg(`¡Importación exitosa! Se han guardado ${res.importedCount} preguntas en Supabase (${importMode === 'replace' ? 'reemplazando anteriores' : 'agregadas al banco'}). Ya están activas para todas las disciplinas de Simulacro.`);
        
        // Almacenar en el navegador para redundancia instantánea en todas las categorías
        try {
          const currentLocal = JSON.parse(localStorage.getItem('simulacro_custom_questions') || '[]');
          const updated = importMode === 'replace' ? payloadQuestions : [...payloadQuestions, ...currentLocal];
          localStorage.setItem('simulacro_custom_questions', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('remanente-simulacro-questions-updated', {
            detail: { count: res.importedCount, category: selectedCategory }
          }));
        } catch (e) {}

        setInputText('');
        setParsedQuestions([]);
        await fetchStats();
        if (onImportSuccess) {
          onImportSuccess(selectedCategory, res.importedCount);
        }
      } else {
        throw new Error(res?.error || 'No se pudo completar la importación.');
      }
    } catch (err) {
      console.error(err);
      alert('Error guardando en la base de datos: ' + (err.message || 'Error de conexión.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Guardar pregunta individual manual
  const handleSingleFormSubmit = (e) => {
    e.preventDefault();
    if (!singleForm.question_text || !singleForm.option_a || !singleForm.option_b) {
      alert('Por favor ingresa al menos el enunciado y las opciones A y B.');
      return;
    }

    const currentBookObj = books.find(b => b.id === parseInt(singleForm.book_id, 10)) || books[0];
    const currentChapterObj = currentBookObj?.chapters?.find(c => c.id === parseInt(singleForm.chapter_id, 10)) || currentBookObj?.chapters?.[0];

    const newQ = {
      chapter_id: currentChapterObj?.id || 1,
      bookName: currentBookObj?.name || '1 Samuel',
      chapterNumber: currentChapterObj?.chapter_number || 1,
      category: singleForm.category,
      question_text: singleForm.question_text.trim(),
      option_a: singleForm.option_a.trim(),
      option_b: singleForm.option_b.trim(),
      option_c: singleForm.option_c.trim() || 'Ninguna de las anteriores',
      option_d: singleForm.option_d.trim() || 'Todas las anteriores',
      correct_answer: singleForm.correct_answer.toLowerCase().trim(),
      difficulty: singleForm.difficulty,
      explanation: singleForm.explanation.trim() || 'Respuesta bíblica oficial NTV.',
      verse_reference: singleForm.verse_reference.trim()
    };

    setParsedQuestions([newQ]);
    setActiveTab('bulk');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl text-white overflow-hidden">
        
        {/* Cabecera del Importador */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow">
              <Database className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Simulacro & Olimpiadas Bíblicas
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">Importador Oficial Supabase</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-serif text-white">
                Importador de Preguntas de Simulacro
              </h3>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de Ámbito / Categoría y Estadísticas en Vivo */}
        <div className="p-3 bg-slate-950/80 border-b border-slate-800 overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-2 min-w-max">
            {FIRE_CATEGORIES.map(cat => {
              const isSelected = selectedCategory === cat.id;
              const count = cat.id === 'all' ? (stats.total || 0) : (stats[cat.id] || 0);
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition cursor-pointer ${
                    isSelected
                      ? `${cat.bg} ${cat.border} ${cat.color} ring-1 ring-amber-400/50 shadow-md`
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span className="text-sm">{cat.icon}</span>
                  <span>{cat.name}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isSelected ? 'bg-white/20 text-white font-black' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pestañas de Modo: Importación Masiva vs Formulario Manual */}
        <div className="px-5 pt-3 pb-0 bg-slate-900 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('bulk')}
              className={`px-4 py-2 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'bulk'
                  ? 'border-amber-400 text-amber-300 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Importación Masiva (.txt / Bloques)</span>
            </button>

            <button
              onClick={() => setActiveTab('form')}
              className={`px-4 py-2 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'form'
                  ? 'border-amber-400 text-amber-300 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Formulario Manual Individual</span>
            </button>
          </div>

          {activeTab === 'bulk' && (
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer pb-2"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showInstructions ? 'Ocultar Formato' : 'Ver Formato'}</span>
            </button>
          )}
        </div>

        {/* Contenido con Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Mensaje de Éxito al Importar */}
          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-3 animate-fadeIn shadow-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* MODO 1: IMPORTACIÓN MASIVA (.TXT / TEXTO) */}
          {activeTab === 'bulk' && (
            <div className="space-y-4">
              
              {/* Caja de Instrucciones de Formato */}
              {showInstructions && (
                <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-blue-200 text-xs space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-blue-300">
                      <BookOpen className="w-4 h-4" />
                      Instrucciones de Formato Oficial
                    </span>
                    <span className="text-[11px] text-blue-400">
                      Compatible con el formato del Importador Global de Quizzes
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Puedes incluir las etiquetas <code>LIBRO:</code> y <code>CAPITULO:</code> para asignar las preguntas a los libros oficiales (1 Samuel, 2 Samuel, 1 Reyes, 2 Reyes). Si no las incluyes, se asignarán automáticamente al ámbito seleccionado arriba.
                  </p>
                  <pre className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-amber-200/90 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`LIBRO: 1 Samuel
CAPITULO: 1

PREGUNTA: ¿Cómo se llamaba la madre del profeta Samuel?
A. Ana
B. Penina
C. Sara
D. Raquel
RESPUESTA: A
EXPLICACION: Ana oró fervientemente a Dios en el templo de Silo.
VERSICULO: 1 Samuel 1:20

PREGUNTA: ¿Quién era el sumo sacerdote que vio orar a Ana?
A. Elí
B. Samuel
C. Aarón
D. Sadoc
RESPUESTA: A
EXPLICACION: Elí observaba su boca en el templo.
VERSICULO: 1 Samuel 1:9`}
                  </pre>
                </div>
              )}

              {/* Botones de Entrada y Carga de Archivo */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".txt,.json,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>Cargar archivo .txt</span>
                  </button>
                  <span className="text-xs text-slate-400">o pega el texto abajo:</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleParse()}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition flex items-center gap-2 shadow cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>Analizar Texto</span>
                </button>
              </div>

              {/* Área de Texto */}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Pega aquí todo el bloque de preguntas en formato estándar..."
                rows={8}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-4 text-xs sm:text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-400/80 transition resize-y leading-relaxed"
              />

              {/* Caja de Errores Detectados */}
              {errors.length > 0 && (
                <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs space-y-2 animate-fadeIn">
                  <h4 className="font-bold flex items-center gap-2 text-red-300">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span>Errores detectados en el formato ({errors.length}):</span>
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-red-300/90 font-mono text-[11px]">
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* VISTA PREVIA DE PREGUNTAS LISTAS PARA GUARDAR */}
              {parsedQuestions.length > 0 && (
                <div className="space-y-4 pt-3 border-t border-slate-800 animate-fadeIn">
                  
                  {/* Barra de Modo de Importación */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Vista Previa ({parsedQuestions.length} preguntas detectadas)</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Revisa las preguntas antes de guardarlas definitivamente en Supabase.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                        <input
                          type="radio"
                          name="importMode"
                          value="append"
                          checked={importMode === 'append'}
                          onChange={(e) => setImportMode(e.target.value)}
                          className="text-amber-500 focus:ring-amber-400"
                        />
                        <span className="font-semibold">Agregar a las existentes</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                        <input
                          type="radio"
                          name="importMode"
                          value="replace"
                          checked={importMode === 'replace'}
                          onChange={(e) => setImportMode(e.target.value)}
                          className="text-amber-500 focus:ring-amber-400"
                        />
                        <span className="font-semibold text-red-300">Reemplazar existentes</span>
                      </label>
                    </div>
                  </div>

                  {/* Cuadrícula de Preguntas en Preview */}
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-2 scrollbar-thin">
                    {parsedQuestions.map((q, idx) => (
                      <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-xs space-y-2 relative group">
                        
                        <div className="flex items-start justify-between gap-2 pr-6">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[10px] uppercase font-mono">
                              {q.bookName} • Cap. {q.chapterNumber}
                            </span>
                            {q.category && (
                              <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                                {q.category}
                              </span>
                            )}
                          </div>
                          
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase font-black text-[10px] font-mono">
                            Respuesta: {q.correct_answer?.toUpperCase()}
                          </span>
                        </div>

                        <p className="font-bold text-white text-sm leading-snug">
                          {idx + 1}. {q.question_text}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-300 pt-1">
                          <div className={`p-1.5 rounded-lg border ${q.correct_answer === 'a' ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200 font-bold' : 'bg-slate-900 border-slate-800'}`}>
                            A. {q.option_a}
                          </div>
                          <div className={`p-1.5 rounded-lg border ${q.correct_answer === 'b' ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200 font-bold' : 'bg-slate-900 border-slate-800'}`}>
                            B. {q.option_b}
                          </div>
                          <div className={`p-1.5 rounded-lg border ${q.correct_answer === 'c' ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200 font-bold' : 'bg-slate-900 border-slate-800'}`}>
                            C. {q.option_c}
                          </div>
                          <div className={`p-1.5 rounded-lg border ${q.correct_answer === 'd' ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200 font-bold' : 'bg-slate-900 border-slate-800'}`}>
                            D. {q.option_d}
                          </div>
                        </div>

                        {(q.explanation || q.verse_reference) && (
                          <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 italic pt-1 border-t border-slate-900">
                            {q.explanation && <span>💡 {q.explanation}</span>}
                            {q.verse_reference && <span className="font-semibold text-amber-300">📖 {q.verse_reference}</span>}
                          </div>
                        )}

                        {/* Botón para descartar del preview */}
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestionFromPreview(idx)}
                          className="absolute top-3 right-3 p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition cursor-pointer"
                          title="Quitar pregunta del preview"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Botón de Guardado */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveToDatabase}
                      disabled={submitting || parsedQuestions.length === 0}
                      className="px-6 py-3 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Guardando en Supabase...</span>
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4" />
                          <span>Guardar {parsedQuestions.length} Pregunta(s) en la Base de Datos</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* MODO 2: FORMULARIO MANUAL INDIVIDUAL */}
          {activeTab === 'form' && (
            <form onSubmit={handleSingleFormSubmit} className="space-y-4 bg-slate-950/70 p-5 rounded-3xl border border-slate-800 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Libro Bíblico:</label>
                  <select
                    value={singleForm.book_id}
                    onChange={(e) => {
                      const bId = e.target.value;
                      const selectedB = books.find(b => b.id === parseInt(bId, 10));
                      setSingleForm(prev => ({
                        ...prev,
                        book_id: bId,
                        chapter_id: selectedB?.chapters?.[0]?.id || ''
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {books.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Capítulo:</label>
                  <select
                    value={singleForm.chapter_id}
                    onChange={(e) => setSingleForm(prev => ({ ...prev, chapter_id: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {(books.find(b => b.id === parseInt(singleForm.book_id, 10))?.chapters || []).map(c => (
                      <option key={c.id} value={c.id}>Capítulo {c.chapter_number}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Categoría Simulacro:</label>
                  <select
                    value={singleForm.category}
                    onChange={(e) => setSingleForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                  >
                    <option value="personajes">👤 Personajes</option>
                    <option value="lugares">📍 Lugares</option>
                    <option value="cantidades">🔢 Cantidades</option>
                    <option value="eventos">⚡ Eventos</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Enunciado de la Pregunta:</label>
                <input
                  type="text"
                  value={singleForm.question_text}
                  onChange={(e) => setSingleForm(prev => ({ ...prev, question_text: e.target.value }))}
                  placeholder="¿En qué monte derrotó Elías a los profetas de Baal?"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Opción A:</label>
                  <input
                    type="text"
                    value={singleForm.option_a}
                    onChange={(e) => setSingleForm(prev => ({ ...prev, option_a: e.target.value }))}
                    placeholder="Monte Carmelo"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Opción B:</label>
                  <input
                    type="text"
                    value={singleForm.option_b}
                    onChange={(e) => setSingleForm(prev => ({ ...prev, option_b: e.target.value }))}
                    placeholder="Monte Sinaí"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Opción C:</label>
                  <input
                    type="text"
                    value={singleForm.option_c}
                    onChange={(e) => setSingleForm(prev => ({ ...prev, option_c: e.target.value }))}
                    placeholder="Monte Gilboa"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Opción D:</label>
                  <input
                    type="text"
                    value={singleForm.option_d}
                    onChange={(e) => setSingleForm(prev => ({ ...prev, option_d: e.target.value }))}
                    placeholder="Monte Horeb"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Opción Correcta:</label>
                  <select
                    value={singleForm.correct_answer}
                    onChange={(e) => setSingleForm(prev => ({ ...prev, correct_answer: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                  >
                    <option value="a">A</option>
                    <option value="b">B</option>
                    <option value="c">C</option>
                    <option value="d">D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Cita / Referencia Bíblica:</label>
                  <input
                    type="text"
                    value={singleForm.verse_reference}
                    onChange={(e) => setSingleForm(prev => ({ ...prev, verse_reference: e.target.value }))}
                    placeholder="1 Reyes 18:20"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Explicación Oficial:</label>
                  <input
                    type="text"
                    value={singleForm.explanation}
                    onChange={(e) => setSingleForm(prev => ({ ...prev, explanation: e.target.value }))}
                    placeholder="Fuego de Dios cayó sobre el altar empapado"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Enviar a Vista Previa</span>
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            Cerrar
          </button>

          <span className="text-[11px] text-slate-400">
            Total en base de datos: <strong className="text-amber-300 font-mono">{stats.total || 0}</strong> preguntas
          </span>
        </div>

      </div>
    </div>
  );
}
