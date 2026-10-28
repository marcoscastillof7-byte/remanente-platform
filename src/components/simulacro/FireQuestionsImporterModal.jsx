import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Upload, X, CheckCircle2, AlertCircle, AlertTriangle, FileText, 
  Sparkles, Layers, RefreshCw, Database, Trash2, HelpCircle, Check, 
  BookOpen, Plus, Copy, Search, Filter, ArrowRight, CornerDownRight
} from 'lucide-react';
import { api } from '../../utils/api';

const FIRE_CATEGORIES = [
  { id: 'all', name: 'Todas las Disciplinas / Libros', icon: '🌟', color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10' },
  { id: 'personajes', name: 'Personajes', icon: '👤', color: 'text-blue-400', border: 'border-blue-500/40', bg: 'bg-blue-500/10' },
  { id: 'lugares', name: 'Lugares', icon: '📍', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' },
  { id: 'cantidades', name: 'Cantidades', icon: '🔢', color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10' },
  { id: 'eventos', name: 'Eventos', icon: '⚡', color: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-500/10' }
];

// Helper para clasificar automáticamente preguntas si no se especifica categoría
const autoClassifyCategory = (text = '', explanation = '', verse = '') => {
  const full = ((text || '') + ' ' + (explanation || '') + ' ' + (verse || '')).toLowerCase();
  
  // 1. Cantidades (números, años, medidas, soldados, días)
  if (
    full.includes('cuánt') || full.includes('cuant') || full.includes('años') ||
    full.includes('días') || full.includes('meses') || full.includes('siclos') ||
    full.includes('codos') || full.includes('hombres') || full.includes('veces') ||
    full.includes('talent') || full.includes('soldad') || full.includes('edad') ||
    full.includes('número') || full.includes('numero') || full.includes('total') ||
    full.includes('primero') || full.includes('segundo') || full.includes('tercero')
  ) {
    return 'cantidades';
  }

  // 2. Lugares (ciudades, montes, valles, ríos, territorios)
  if (
    full.includes('dónde') || full.includes('donde') || full.includes('lugar') ||
    full.includes('ciudad') || full.includes('monte') || full.includes('valle') ||
    full.includes('cueva') || full.includes('río') || full.includes('rio') ||
    full.includes('jerusalén') || full.includes('belén') || full.includes('hebrón') ||
    full.includes('gilgal') || full.includes('silo') || full.includes('bet-el') ||
    full.includes('carmelo') || full.includes('samaria') || full.includes('gat') ||
    full.includes('siclag') || full.includes('nob') || full.includes('en-gadi') ||
    full.includes('jordán') || full.includes('jordan') || full.includes('egipto') ||
    full.includes('asiria') || full.includes('babilonia') || full.includes('tiro') ||
    full.includes('sión') || full.includes('sion') || full.includes('mizpa') ||
    full.includes('jabes') || full.includes('tabernáculo')
  ) {
    return 'lugares';
  }

  // 3. Eventos (batallas, muertes, milagros, pactos, juicios)
  if (
    full.includes('batalla') || full.includes('guerra') || full.includes('murió') ||
    full.includes('mató') || full.includes('pacto') || full.includes('milagro') ||
    full.includes('sucedió') || full.includes('pasó') || full.includes('castigo') ||
    full.includes('derrotó') || full.includes('escapó') || full.includes('ungió') ||
    full.includes('oró') || full.includes('sueño') || full.includes('visión') ||
    full.includes('arca') || full.includes('altar') || full.includes('fuego') ||
    full.includes('becerro') || full.includes('espada') || full.includes('lanza') ||
    full.includes('honda') || full.includes('estatua') || full.includes('manto') ||
    full.includes('hambre') || full.includes('peste') || full.includes('plaga') ||
    full.includes('edificó') || full.includes('construyó') || full.includes('resucitó')
  ) {
    return 'eventos';
  }

  // 4. Personajes (por defecto o si menciona nombres)
  return 'personajes';
};

const normalizeText = (str) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function FireQuestionsImporterModal({ isOpen, onClose, onImportSuccess }) {
  // Pestaña activa: 'rows' (Editor por Renglones) | 'bulk' (Pegar Texto / .txt) | 'single' (Formulario 1 a 1)
  const [activeTab, setActiveTab] = useState('rows');

  // Categoría global / filtro activo
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modo de guardado: 'append' (agregar) | 'replace' (reemplazar)
  const [importMode, setImportMode] = useState('append');

  // Texto bruto para importar en lote
  const [inputText, setInputText] = useState('');

  // Lista viva de Renglones de Preguntas
  const [rows, setRows] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Errores y Mensajes de estado
  const [errors, setErrors] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');

  // Catálogo de libros y capítulos desde la API / Supabase
  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ personajes: 0, lugares: 0, cantidades: 0, eventos: 0, total: 0 });
  const [showInstructions, setShowInstructions] = useState(false);

  const fileInputRef = useRef(null);

  // Formulario de inserción individual rápida
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

  // Cargar catálogo de libros, capítulos y conteos al abrir
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

  // Helper para buscar un libro por nombre o slug
  const findBookByName = (name) => {
    if (!name || books.length === 0) return books[0] || null;
    const clean = normalizeText(name);
    return books.find(b => {
      const bClean = normalizeText(b.name);
      return bClean.includes(clean) || clean.includes(bClean);
    }) || books[0];
  };

  // Helper para buscar el chapter_id exacto dado un libro y un número de capítulo
  const resolveChapterId = (book, chapterNum) => {
    if (!book) return 1;
    const ch = book.chapters?.find(c => c.chapter_number === parseInt(chapterNum, 10));
    return ch?.id || book.chapters?.[0]?.id || 1;
  };

  // PARSER UNIVERSAL A PRUEBA DE FALLAS
  const parseQuestionsText = (rawText) => {
    const textToProcess = (typeof rawText === 'string' ? rawText : inputText).trim();
    if (!textToProcess) {
      return { parsed: [], errors: ['El texto está vacío. Por favor escribe, pega o sube un archivo.'] };
    }

    // 1. Detección automática si es formato JSON
    if (textToProcess.startsWith('[') || textToProcess.startsWith('{')) {
      try {
        const parsed = JSON.parse(textToProcess);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const defaultBook = books[0] || { id: 1, name: '1 Samuel', chapters: [] };
        
        const validated = list.map((q, idx) => {
          const bObj = books.find(b => b.id === parseInt(q.book_id || q.bookId, 10)) || findBookByName(q.bookName || q.book);
          const chNum = parseInt(q.chapter_number || q.chapterNumber || q.chapter || 1, 10);
          const chId = q.chapter_id || resolveChapterId(bObj, chNum);
          const cat = q.category || q.custom_category || autoClassifyCategory(q.question_text, q.explanation, q.verse_reference);
          
          let ans = (q.correct_answer || q.respuesta || 'a').toString().toLowerCase().trim();
          const matchAns = ans.match(/[a-d]/);
          ans = matchAns ? matchAns[0] : 'a';

          return {
            id: `row_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
            book_id: bObj?.id || 1,
            bookName: bObj?.name || '1 Samuel',
            chapterNumber: chNum,
            chapter_id: chId,
            category: cat,
            question_text: (q.question_text || q.pregunta || '').trim(),
            option_a: (q.option_a || q.a || '').trim(),
            option_b: (q.option_b || q.b || '').trim(),
            option_c: (q.option_c || q.c || '').trim() || 'Ninguna de las anteriores',
            option_d: (q.option_d || q.d || '').trim() || 'Todas las anteriores',
            correct_answer: ans,
            explanation: (q.explanation || q.explicacion || '').trim(),
            verse_reference: (q.verse_reference || q.versiculo || '').trim(),
            difficulty: q.difficulty || 'medio'
          };
        }).filter(q => q.question_text && q.option_a && q.option_b);

        if (validated.length > 0) {
          return { parsed: validated, errors: [] };
        }
      } catch (e) {}
    }

    // 2. Parser Universal línea por línea y bloque por bloque
    const lines = textToProcess.split('\n').map(l => l.trim());
    const parsed = [];
    const localErrors = [];

    let currentBook = books.length > 0 ? books[0] : { id: 1, name: '1 Samuel', chapters: [] };
    let currentChapterNum = currentBook.chapters?.[0]?.chapter_number || 1;
    let currentChapterId = currentBook.chapters?.[0]?.id || 1;
    let currentCategory = selectedCategory !== 'all' ? selectedCategory : 'personajes';

    let currentQ = null;

    const commitCurrentQ = () => {
      if (!currentQ) return;
      if (!currentQ.question_text) return;
      if (!currentQ.option_a || !currentQ.option_b) {
        localErrors.push(`Pregunta omitida por falta de opciones A y B: "${currentQ.question_text.substring(0, 45)}..."`);
        currentQ = null;
        return;
      }

      // Si faltan opciones C y D, proveer alternativas estándar
      if (!currentQ.option_c) currentQ.option_c = 'Ninguna de las anteriores';
      if (!currentQ.option_d) currentQ.option_d = 'Todas las anteriores';

      // Asegurar que la respuesta correcta es estrictamente 'a', 'b', 'c' o 'd'
      const matchAns = String(currentQ.correct_answer || 'a').toLowerCase().match(/[a-d]/);
      currentQ.correct_answer = matchAns ? matchAns[0] : 'a';

      // Si no tiene categoría explícita, clasificar por palabras clave
      if (!currentQ.category || currentQ.category === 'all') {
        currentQ.category = autoClassifyCategory(currentQ.question_text, currentQ.explanation, currentQ.verse_reference);
      }

      parsed.push(currentQ);
      currentQ = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // 1. Detección de LIBRO
      const matchLibro = line.match(/^LIBRO\s*[:\-.]?\s*(.+)$/i);
      if (matchLibro) {
        commitCurrentQ();
        const bName = matchLibro[1].trim();
        const found = findBookByName(bName);
        if (found) {
          currentBook = found;
          currentChapterNum = found.chapters?.[0]?.chapter_number || 1;
          currentChapterId = found.chapters?.[0]?.id || 1;
        } else {
          localErrors.push(`Línea ${i + 1}: Libro "${bName}" no reconocido. Se utilizará ${currentBook.name}.`);
        }
        continue;
      }

      // 2. Detección de CAPITULO
      const matchCapitulo = line.match(/^CAP[IÍ]TULO\s*[:\-.]?\s*(\d+)/i) || line.match(/^CAP\s*[:\-.]?\s*(\d+)/i);
      if (matchCapitulo) {
        commitCurrentQ();
        const cNum = parseInt(matchCapitulo[1], 10);
        currentChapterNum = cNum;
        currentChapterId = resolveChapterId(currentBook, cNum);
        continue;
      }

      // 3. Detección de CATEGORIA
      const matchCat = line.match(/^(?:CATEGOR[IÍ]A|CATEGORIA|DISCIPLINA|TIPO)\s*[:\-.]?\s*(.+)$/i);
      if (matchCat) {
        const catRaw = normalizeText(matchCat[1]);
        if (catRaw.includes('personaje')) currentCategory = 'personajes';
        else if (catRaw.includes('lugar')) currentCategory = 'lugares';
        else if (catRaw.includes('cantida') || catRaw.includes('numero')) currentCategory = 'cantidades';
        else if (catRaw.includes('evento') || catRaw.includes('suceso')) currentCategory = 'eventos';
        continue;
      }

      // 4. Detección de INICIO DE PREGUNTA
      // Formatos soportados:
      // - PREGUNTA 1: ¿Texto? / PREGUNTA: ¿Texto? / P1: Texto
      // - 1. ¿Texto? / 1) Texto / 1.- Texto / 1 - Texto
      // - ¿Texto de la pregunta?
      // - O una frase normal si la siguiente línea es la Opción A
      const matchPreguntaPrefix = line.match(/^(?:PREGUNTA|P)\s*#?\s*\d*\s*[:\-.]?\s*(.+)$/i);
      const matchNumbered = line.match(/^(\d+)[\.\-\)]\s*(.+)$/);
      const isDirectQuestion = line.startsWith('¿') || line.startsWith('?');
      
      const nextLine = lines[i + 1] || '';
      const nextIsOptionA = nextLine.match(/^[•\-\*]?\s*[\(]?[A|a][\)\.\-:]\s*(.+)$/);

      if (matchPreguntaPrefix || matchNumbered || isDirectQuestion || (nextIsOptionA && !line.match(/^[•\-\*]?\s*[\(]?[A-Da-d][\)\.\-:]/))) {
        commitCurrentQ();

        let qText = '';
        if (matchPreguntaPrefix) {
          qText = matchPreguntaPrefix[1];
        } else if (matchNumbered) {
          qText = matchNumbered[2];
        } else {
          qText = line;
        }

        // Limpiar numeraciones redundantes al inicio del enunciado
        qText = qText.replace(/^\d+[\.\-\)]\s*/, '').trim();

        currentQ = {
          id: `row_${Date.now()}_${parsed.length}_${Math.random().toString(36).substr(2, 4)}`,
          book_id: currentBook?.id || 1,
          bookName: currentBook?.name || '1 Samuel',
          chapterNumber: currentChapterNum,
          chapter_id: currentChapterId,
          category: selectedCategory !== 'all' ? selectedCategory : currentCategory,
          question_text: qText,
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
          correct_answer: 'a',
          explanation: '',
          verse_reference: '',
          difficulty: 'medio'
        };
        continue;
      }

      // 5. Detección de OPCIONES Y METADATOS dentro de la pregunta en curso
      if (currentQ) {
        // Opción A
        const matchA = line.match(/^[•\-\*]?\s*[\(]?[A|a][\)\.\-:]\s*(.+)$/);
        if (matchA) {
          currentQ.option_a = matchA[1].trim();
          continue;
        }

        // Opción B
        const matchB = line.match(/^[•\-\*]?\s*[\(]?[B|b][\)\.\-:]\s*(.+)$/);
        if (matchB) {
          currentQ.option_b = matchB[1].trim();
          continue;
        }

        // Opción C
        const matchC = line.match(/^[•\-\*]?\s*[\(]?[C|c][\)\.\-:]\s*(.+)$/);
        if (matchC) {
          currentQ.option_c = matchC[1].trim();
          continue;
        }

        // Opción D
        const matchD = line.match(/^[•\-\*]?\s*[\(]?[D|d][\)\.\-:]\s*(.+)$/);
        if (matchD) {
          currentQ.option_d = matchD[1].trim();
          continue;
        }

        // Respuesta Correcta: RESPUESTA:, CORRECTA:, CLAVE:, R:, SOLUCIÓN:, RTA:
        const matchResp = line.match(/^(?:RESPUESTA(?:\s+CORRECTA)?|CORRECTA|CLAVE|SOLUCI[OÓ]N|RTA|R)\s*[:\-.]?\s*[\(]?([A-Da-d])(?:[\)\.\-:]\s*.*)?$/i);
        if (matchResp) {
          currentQ.correct_answer = matchResp[1].toLowerCase();
          continue;
        }

        // Explicación
        const matchExp = line.match(/^(?:EXPLICACI[OÓ]N|EXPLICACION|EXP|NOTA|COMENTARIO)\s*[:\-.]?\s*(.+)$/i);
        if (matchExp) {
          currentQ.explanation = matchExp[1].trim();
          continue;
        }

        // Cita Bíblica / Versículo
        const matchVer = line.match(/^(?:VERS[IÍ]CULO|VERSICULO|CITA|REFERENCIA|REF)\s*[:\-.]?\s*(.+)$/i);
        if (matchVer) {
          const vRef = matchVer[1].trim();
          currentQ.verse_reference = vRef;

          // Auto-detección inteligente de libro y capítulo dentro de la cita bíblica
          const matchBibleRef = vRef.match(/([12]\s*(?:Samuel|Reyes))\s*(\d+)[:\.]/i);
          if (matchBibleRef) {
            const detectedBookName = matchBibleRef[1].trim();
            const detectedChapterNum = parseInt(matchBibleRef[2], 10);
            const foundB = findBookByName(detectedBookName);
            if (foundB) {
              currentQ.book_id = foundB.id;
              currentQ.bookName = foundB.name;
              currentQ.chapterNumber = detectedChapterNum;
              currentQ.chapter_id = resolveChapterId(foundB, detectedChapterNum);
            }
          }
          continue;
        }

        // Dificultad
        const matchDif = line.match(/^(?:DIFICULTAD|NIVEL)\s*[:\-.]?\s*(f[aá]cil|medio|dif[ií]cil)/i);
        if (matchDif) {
          currentQ.difficulty = normalizeText(matchDif[1]);
          continue;
        }

        // Si es una línea de continuación para la pregunta
        if (!currentQ.option_a && !currentQ.option_b) {
          currentQ.question_text += ' ' + line;
        }
      }
    }

    commitCurrentQ();

    if (parsed.length === 0 && localErrors.length === 0) {
      localErrors.push('No se pudieron reconocer preguntas válidas. Asegúrate de incluir el enunciado y las opciones A y B.');
    }

    return { parsed, errors: localErrors };
  };

  // Cargar archivo .txt desde el equipo
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setInputText(content);
        processTextToRows(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Procesar texto bruto y alimentar directamente los Renglones
  const processTextToRows = (text = inputText) => {
    setSuccessMsg('');
    const { parsed, errors: parseErrors } = parseQuestionsText(text);
    setErrors(parseErrors);

    if (parsed.length > 0) {
      setRows(prev => [...prev, ...parsed]);
      setActiveTab('rows');
      setSuccessMsg(`¡Éxito! Se cargaron ${parsed.length} preguntas en sus respectivos renglones.`);
    }
  };

  // AGREGAR UN RENGLÓN EN BLANCO MANUALMENTE
  const handleAddNewRow = () => {
    const defaultBook = books[0] || { id: 1, name: '1 Samuel', chapters: [] };
    const defaultChapter = defaultBook.chapters?.[0] || { id: 1, chapter_number: 1 };
    
    const newRow = {
      id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      book_id: defaultBook.id,
      bookName: defaultBook.name,
      chapterNumber: defaultChapter.chapter_number,
      chapter_id: defaultChapter.id,
      category: selectedCategory !== 'all' ? selectedCategory : 'personajes',
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'a',
      explanation: '',
      verse_reference: '',
      difficulty: 'medio'
    };

    setRows(prev => [newRow, ...prev]);
    setActiveTab('rows');
  };

  // MODIFICAR UN CAMPO DE UN RENGLÓN EN TIEMPO REAL
  const handleUpdateRow = (id, field, value) => {
    setRows(prev => prev.map(row => {
      if (row.id !== id) return row;
      
      const updated = { ...row, [field]: value };

      // Si cambió el libro, actualizar también el bookName y el chapter_id correspondiente
      if (field === 'book_id') {
        const bObj = books.find(b => b.id === parseInt(value, 10));
        if (bObj) {
          updated.bookName = bObj.name;
          const firstCh = bObj.chapters?.[0];
          updated.chapterNumber = firstCh?.chapter_number || 1;
          updated.chapter_id = firstCh?.id || 1;
        }
      }

      // Si cambió el capítulo, actualizar el chapterNumber y chapter_id
      if (field === 'chapter_id') {
        const bObj = books.find(b => b.id === parseInt(row.book_id, 10));
        const chObj = bObj?.chapters?.find(c => c.id === parseInt(value, 10));
        if (chObj) {
          updated.chapterNumber = chObj.chapter_number;
        }
      }

      return updated;
    }));
  };

  // ELIMINAR UN RENGLÓN
  const handleDeleteRow = (id) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  // DUPLICAR UN RENGLÓN
  const handleDuplicateRow = (row) => {
    const duplicated = {
      ...row,
      id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
    };
    setRows(prev => [duplicated, ...prev]);
  };

  // VACIAR TODOS LOS RENGLONES
  const handleClearAllRows = () => {
    if (rows.length === 0) return;
    if (window.confirm(`¿Estás seguro de vaciar todos los ${rows.length} renglones actuales?`)) {
      setRows([]);
      setSuccessMsg('');
      setErrors([]);
    }
  };

  // GUARDAR DEFINITIVAMENTE TODOS LOS RENGLONES EN SUPABASE
  const handleSaveRowsToDatabase = async () => {
    const validRows = rows.filter(r => r.question_text.trim() && r.option_a.trim() && r.option_b.trim());
    if (validRows.length === 0) {
      alert('No hay renglones completos para guardar. Cada pregunta requiere al menos el enunciado y las opciones A y B.');
      return;
    }

    setSubmitting(true);
    setSuccessMsg('');
    setErrors([]);

    try {
      const payloadQuestions = validRows.map(r => ({
        chapter_id: r.chapter_id || 1,
        question_text: r.question_text.trim(),
        option_a: r.option_a.trim(),
        option_b: r.option_b.trim(),
        option_c: r.option_c.trim() || 'Ninguna de las anteriores',
        option_d: r.option_d.trim() || 'Todas las anteriores',
        correct_answer: (r.correct_answer || 'a').toLowerCase().trim(),
        difficulty: r.difficulty || 'medio',
        explanation: r.explanation.trim() || 'Respuesta bíblica oficial NTV.',
        verse_reference: r.verse_reference.trim(),
        custom_category: r.category || selectedCategory
      }));

      const res = await api.post('/simulacro/questions/import', {
        category: selectedCategory !== 'all' ? selectedCategory : null,
        questions: payloadQuestions,
        mode: importMode
      });

      if (res && res.success) {
        setSuccessMsg(`¡Guardado exitoso! Se han sincronizado ${res.importedCount} preguntas en Supabase. Están disponibles en los 4 formatos de competencia (Fire Questions, David & Goliat, El Dado Dado y La Ruleta).`);

        // Actualizar almacenamiento local para disponibilidad inmediata
        try {
          const currentLocal = JSON.parse(localStorage.getItem('simulacro_custom_questions') || '[]');
          const updated = importMode === 'replace' ? payloadQuestions : [...payloadQuestions, ...currentLocal];
          localStorage.setItem('simulacro_custom_questions', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('remanente-simulacro-questions-updated', {
            detail: { count: res.importedCount, category: selectedCategory }
          }));
        } catch (e) {}

        await fetchStats();
        if (onImportSuccess) {
          onImportSuccess(selectedCategory, res.importedCount);
        }
      } else {
        throw new Error(res?.error || 'No se pudo completar el guardado en Supabase.');
      }
    } catch (err) {
      console.error(err);
      alert('Error guardando en la base de datos: ' + (err.message || 'Error de conexión.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Filtrado de renglones para la vista previa
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchesSearch = !searchFilter || 
        r.question_text.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.bookName?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.verse_reference?.toLowerCase().includes(searchFilter.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [rows, searchFilter, categoryFilter]);

  const validRowCount = useMemo(() => {
    return rows.filter(r => r.question_text.trim() && r.option_a.trim() && r.option_b.trim()).length;
  }, [rows]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl max-w-6xl w-full max-h-[96vh] flex flex-col shadow-2xl text-white overflow-hidden">
        
        {/* Cabecera Principal */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow">
              <Database className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Banco Desvinculado de Simulacro
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">Independiente de los Quizzes de Capítulos</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-serif text-white">
                Importador y Editor de Preguntas para Bancos de Clase
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

        {/* Barra de Ámbitos y Conteo en Vivo */}
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

        {/* Pestañas de Navegación */}
        <div className="px-5 pt-3 pb-0 bg-slate-900 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('rows')}
              className={`px-3 sm:px-4 py-2 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'rows'
                  ? 'border-amber-400 text-amber-300 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Editor de Renglones</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                {rows.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('bulk')}
              className={`px-3 sm:px-4 py-2 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'bulk'
                  ? 'border-amber-400 text-amber-300 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Pegar Texto / Archivo .txt</span>
            </button>

            <button
              onClick={() => setActiveTab('single')}
              className={`px-3 sm:px-4 py-2 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'single'
                  ? 'border-amber-400 text-amber-300 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Añadir 1 Renglón</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={handleAddNewRow}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              title="Añadir nuevo renglón vacío"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nuevo Renglón</span>
            </button>
          </div>
        </div>

        {/* Área Central con Scroll */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          
          {/* Alertas de Éxito y Errores */}
          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-3 animate-fadeIn shadow-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errors.length > 0 && (
            <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs space-y-2 animate-fadeIn">
              <h4 className="font-bold flex items-center gap-2 text-red-300">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>Avisos detectados ({errors.length}):</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-red-300/90 font-mono text-[11px]">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 1: EDITOR DE RENGLONES (VISTA DE FILAS / TABLA)         */}
          {/* ============================================================== */}
          {activeTab === 'rows' && (
            <div className="space-y-4">
              
              {/* Barra de Búsqueda, Filtro y Controles de Renglón */}
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 ml-2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Buscar en los renglones..."
                    className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
                  />
                  {searchFilter && (
                    <button onClick={() => setSearchFilter('')} className="text-slate-400 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-slate-700">
                    <Filter className="w-3.5 h-3.5 text-amber-400" />
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="bg-transparent text-slate-300 focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todas las categorías</option>
                      <option value="personajes">👤 Personajes</option>
                      <option value="lugares">📍 Lugares</option>
                      <option value="cantidades">🔢 Cantidades</option>
                      <option value="eventos">⚡ Eventos</option>
                    </select>
                  </div>

                  <span className="text-slate-400 text-[11px]">
                    Mostrando <strong className="text-amber-300 font-mono">{filteredRows.length}</strong> de <strong className="text-slate-200 font-mono">{rows.length}</strong>
                  </span>

                  {rows.length > 0 && (
                    <button
                      onClick={handleClearAllRows}
                      className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Vaciar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Si no hay renglones cargados todavía */}
              {rows.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-3xl border border-dashed border-slate-800 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-white">No hay renglones de preguntas aún</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Carga un archivo <code>.txt</code>, pega un bloque de preguntas o agrega un renglón nuevo directamente para editar cada campo.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => setActiveTab('bulk')}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Pegar Texto o Subir .txt</span>
                    </button>
                    <button
                      onClick={handleAddNewRow}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs border border-slate-700 flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-amber-400" />
                      <span>Crear Renglón Manual</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* LISTA DE RENGLONES INTERACTIVOS */
                <div className="space-y-4">
                  {filteredRows.map((row, idx) => {
                    const isValid = row.question_text.trim() && row.option_a.trim() && row.option_b.trim();
                    const currentBookObj = books.find(b => b.id === parseInt(row.book_id, 10)) || books[0];
                    const chaptersList = currentBookObj?.chapters || [];

                    return (
                      <div 
                        key={row.id} 
                        className={`p-4 rounded-2xl border transition-all ${
                          isValid 
                            ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700 shadow-md' 
                            : 'bg-red-950/20 border-red-500/40 ring-1 ring-red-500/20'
                        }`}
                      >
                        {/* Cabecera del Renglón: Número, Selectores de Libro/Capítulo/Categoría y Acciones */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-black text-xs border border-amber-500/30">
                              Renglón #{idx + 1}
                            </span>

                            {/* Selector de Libro */}
                            <select
                              value={row.book_id}
                              onChange={(e) => handleUpdateRow(row.id, 'book_id', e.target.value)}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                            >
                              {books.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>

                            {/* Selector de Capítulo */}
                            <select
                              value={row.chapter_id}
                              onChange={(e) => handleUpdateRow(row.id, 'chapter_id', e.target.value)}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                            >
                              {chaptersList.map(c => (
                                <option key={c.id} value={c.id}>Capítulo {c.chapter_number}</option>
                              ))}
                            </select>

                            {/* Selector de Categoría */}
                            <select
                              value={row.category}
                              onChange={(e) => handleUpdateRow(row.id, 'category', e.target.value)}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400 cursor-pointer"
                            >
                              <option value="personajes">👤 Personajes</option>
                              <option value="lugares">📍 Lugares</option>
                              <option value="cantidades">🔢 Cantidades</option>
                              <option value="eventos">⚡ Eventos</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            {isValid ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Renglón Listo</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-400" />
                                <span>Faltan Opciones</span>
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDuplicateRow(row)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                              title="Duplicar este renglón"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-300 transition cursor-pointer"
                              title="Eliminar este renglón"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Enunciado de la Pregunta */}
                        <div className="pt-3">
                          <label className="block text-[11px] font-bold text-slate-400 mb-1">
                            Enunciado de la Pregunta:
                          </label>
                          <textarea
                            value={row.question_text}
                            onChange={(e) => handleUpdateRow(row.id, 'question_text', e.target.value)}
                            placeholder="Escribe aquí la pregunta bíblica (ej. ¿Quién fue el sucesor de Moisés?)..."
                            rows={2}
                            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400 resize-none font-medium"
                          />
                        </div>

                        {/* Opciones A, B, C, D con botón interactivo para seleccionar la respuesta correcta */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                          
                          {/* Opción A */}
                          <div className={`p-2 rounded-xl border flex items-center gap-2 transition ${
                            row.correct_answer === 'a' 
                              ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-sm' 
                              : 'bg-slate-900 border-slate-800'
                          }`}>
                            <button
                              type="button"
                              onClick={() => handleUpdateRow(row.id, 'correct_answer', 'a')}
                              className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 cursor-pointer transition ${
                                row.correct_answer === 'a'
                                  ? 'bg-emerald-500 text-slate-950 shadow'
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                              }`}
                              title="Marcar como respuesta correcta"
                            >
                              A
                            </button>
                            <input
                              type="text"
                              value={row.option_a}
                              onChange={(e) => handleUpdateRow(row.id, 'option_a', e.target.value)}
                              placeholder="Opción A (Requerida)"
                              className="w-full bg-transparent text-xs text-white placeholder:text-slate-600 focus:outline-none"
                            />
                          </div>

                          {/* Opción B */}
                          <div className={`p-2 rounded-xl border flex items-center gap-2 transition ${
                            row.correct_answer === 'b' 
                              ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-sm' 
                              : 'bg-slate-900 border-slate-800'
                          }`}>
                            <button
                              type="button"
                              onClick={() => handleUpdateRow(row.id, 'correct_answer', 'b')}
                              className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 cursor-pointer transition ${
                                row.correct_answer === 'b'
                                  ? 'bg-emerald-500 text-slate-950 shadow'
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                              }`}
                              title="Marcar como respuesta correcta"
                            >
                              B
                            </button>
                            <input
                              type="text"
                              value={row.option_b}
                              onChange={(e) => handleUpdateRow(row.id, 'option_b', e.target.value)}
                              placeholder="Opción B (Requerida)"
                              className="w-full bg-transparent text-xs text-white placeholder:text-slate-600 focus:outline-none"
                            />
                          </div>

                          {/* Opción C */}
                          <div className={`p-2 rounded-xl border flex items-center gap-2 transition ${
                            row.correct_answer === 'c' 
                              ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-sm' 
                              : 'bg-slate-900 border-slate-800'
                          }`}>
                            <button
                              type="button"
                              onClick={() => handleUpdateRow(row.id, 'correct_answer', 'c')}
                              className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 cursor-pointer transition ${
                                row.correct_answer === 'c'
                                  ? 'bg-emerald-500 text-slate-950 shadow'
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                              }`}
                              title="Marcar como respuesta correcta"
                            >
                              C
                            </button>
                            <input
                              type="text"
                              value={row.option_c}
                              onChange={(e) => handleUpdateRow(row.id, 'option_c', e.target.value)}
                              placeholder="Opción C (Opcional - por defecto 'Ninguna')"
                              className="w-full bg-transparent text-xs text-white placeholder:text-slate-600 focus:outline-none"
                            />
                          </div>

                          {/* Opción D */}
                          <div className={`p-2 rounded-xl border flex items-center gap-2 transition ${
                            row.correct_answer === 'd' 
                              ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-sm' 
                              : 'bg-slate-900 border-slate-800'
                          }`}>
                            <button
                              type="button"
                              onClick={() => handleUpdateRow(row.id, 'correct_answer', 'd')}
                              className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 cursor-pointer transition ${
                                row.correct_answer === 'd'
                                  ? 'bg-emerald-500 text-slate-950 shadow'
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                              }`}
                              title="Marcar como respuesta correcta"
                            >
                              D
                            </button>
                            <input
                              type="text"
                              value={row.option_d}
                              onChange={(e) => handleUpdateRow(row.id, 'option_d', e.target.value)}
                              placeholder="Opción D (Opcional - por defecto 'Todas')"
                              className="w-full bg-transparent text-xs text-white placeholder:text-slate-600 focus:outline-none"
                            />
                          </div>

                        </div>

                        {/* Fila Inferior: Referencia Bíblica y Explicación */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5 text-xs">
                          <div>
                            <input
                              type="text"
                              value={row.verse_reference}
                              onChange={(e) => handleUpdateRow(row.id, 'verse_reference', e.target.value)}
                              placeholder="📖 Cita bíblica (ej. 1 Samuel 17:40)"
                              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-amber-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={row.explanation}
                              onChange={(e) => handleUpdateRow(row.id, 'explanation', e.target.value)}
                              placeholder="💡 Explicación bíblica de la respuesta correcta"
                              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 2: PEGAR TEXTO O SUBIR ARCHIVO .TXT                     */}
          {/* ============================================================== */}
          {activeTab === 'bulk' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Botón de Ayuda con Guía de Formato */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Pega preguntas en cualquier formato o usa un archivo <code>.txt</code>. El sistema las convertirá automáticamente en renglones.
                </span>
                <button
                  type="button"
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showInstructions ? 'Ocultar Ejemplos' : 'Ver Ejemplos de Formato'}</span>
                </button>
              </div>

              {showInstructions && (
                <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-blue-200 text-xs space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-blue-300">
                      <BookOpen className="w-4 h-4" />
                      Formatos Soportados Automáticamente
                    </span>
                    <span className="text-[11px] text-blue-400">
                      No importa cómo empiece la pregunta (con número, con ¿ o con PREGUNTA:)
                    </span>
                  </div>
                  <pre className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-amber-200/90 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`LIBRO: 1 Samuel
CAPITULO: 17

1. ¿Cuántas piedras lisas recogió David del arroyo?
A. 5 piedras
B. 3 piedras
C. 7 piedras
D. 1 piedra
RESPUESTA: A
EXPLICACION: David escogió cinco piedras lisas para su honda.
VERSICULO: 1 Samuel 17:40

¿Quién ungió a Saúl como el primer rey de Israel?
• A. Samuel
• B. Natán
• C. Elí
• D. Gad
Clave: A`}
                  </pre>
                </div>
              )}

              {/* Botones de Carga y Acción */}
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
                  <span className="text-xs text-slate-400">o pega el texto en el área de abajo:</span>
                </div>

                <button
                  type="button"
                  onClick={() => processTextToRows()}
                  disabled={!inputText.trim()}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl text-xs sm:text-sm transition flex items-center gap-2 shadow cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>Procesar y Pasar a Renglones</span>
                </button>
              </div>

              {/* Textarea */}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Pega aquí tus preguntas bíblicas..."
                rows={10}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-4 text-xs sm:text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-400/80 transition resize-y leading-relaxed"
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 3: FORMULARIO INDIVIDUAL RÁPIDO                         */}
          {/* ============================================================== */}
          {activeTab === 'single' && (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!singleForm.question_text || !singleForm.option_a || !singleForm.option_b) {
                  alert('Por favor ingresa al menos el enunciado y las opciones A y B.');
                  return;
                }

                const currentBookObj = books.find(b => b.id === parseInt(singleForm.book_id, 10)) || books[0];
                const currentChapterObj = currentBookObj?.chapters?.find(c => c.id === parseInt(singleForm.chapter_id, 10)) || currentBookObj?.chapters?.[0];

                const newR = {
                  id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                  book_id: currentBookObj?.id || 1,
                  bookName: currentBookObj?.name || '1 Samuel',
                  chapterNumber: currentChapterObj?.chapter_number || 1,
                  chapter_id: currentChapterObj?.id || 1,
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

                setRows(prev => [newR, ...prev]);
                setSingleForm(prev => ({
                  ...prev,
                  question_text: '',
                  option_a: '',
                  option_b: '',
                  option_c: '',
                  option_d: '',
                  verse_reference: '',
                  explanation: ''
                }));
                setActiveTab('rows');
                setSuccessMsg('¡Renglón agregado con éxito a la lista!');
              }} 
              className="space-y-4 bg-slate-950/70 p-5 rounded-3xl border border-slate-800 animate-fadeIn"
            >
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
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Opción A (Requerida):</label>
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
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Opción B (Requerida):</label>
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
                  <Plus className="w-4 h-4" />
                  <span>Insertar en Renglones</span>
                </button>
              </div>
            </form>
          )}

        </div>

        {/* ============================================================== */}
        {/* BARRA INFERIOR / PIE DE ACCIONES Y GUARDADO                    */}
        {/* ============================================================== */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-400">Modo de sincronización:</span>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="radio"
                name="footerImportMode"
                value="append"
                checked={importMode === 'append'}
                onChange={(e) => setImportMode(e.target.value)}
                className="text-amber-500 focus:ring-amber-400"
              />
              <span className="font-semibold">Agregar al banco</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="radio"
                name="footerImportMode"
                value="replace"
                checked={importMode === 'replace'}
                onChange={(e) => setImportMode(e.target.value)}
                className="text-amber-500 focus:ring-amber-400"
              />
              <span className="font-semibold text-red-300">Reemplazar categoría</span>
            </label>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleSaveRowsToDatabase}
              disabled={submitting || validRowCount === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Guardando en Supabase...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>Guardar {validRowCount} Renglones en Supabase</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
