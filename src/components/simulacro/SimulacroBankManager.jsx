import { useState, useEffect, useMemo } from 'react';
import { 
  Database, Layers, Plus, Upload, Trash2, Edit3, Search, Filter, 
  RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, BarChart3, 
  PieChart, Sparkles, Download, Check, X, BookOpen, Shield, HelpCircle,
  TrendingUp, Activity, CheckCircle
} from 'lucide-react';
import { api } from '../../utils/api';

const CLASSES = [
  { id: 'personajes', name: 'Personajes', fullName: 'Banco de Personajes', icon: '👤', color: 'from-blue-600 to-indigo-600', textColor: 'text-blue-400', borderColor: 'border-blue-500/40', bgColor: 'bg-blue-500/10', desc: 'Reyes, profetas, valientes, sacerdotes y figuras clave de Samuel y Reyes.' },
  { id: 'lugares', name: 'Lugares', fullName: 'Banco de Lugares', icon: '📍', color: 'from-emerald-600 to-teal-600', textColor: 'text-emerald-400', borderColor: 'border-emerald-500/40', bgColor: 'bg-emerald-500/10', desc: 'Ciudades, montes, valles, ríos, santuarios y fortalezas bíblicas.' },
  { id: 'cantidades', name: 'Cantidades', fullName: 'Banco de Cantidades', icon: '🔢', color: 'from-amber-600 to-yellow-600', textColor: 'text-amber-400', borderColor: 'border-amber-500/40', bgColor: 'bg-amber-500/10', desc: 'Años de reinado, siclos, codos, medidas, soldados, días y cantidades bíblicas.' },
  { id: 'eventos', name: 'Eventos', fullName: 'Banco de Eventos', icon: '⚡', color: 'from-purple-600 to-pink-600', textColor: 'text-purple-400', borderColor: 'border-purple-500/40', bgColor: 'bg-purple-500/10', desc: 'Batallas, milagros, pactos solemnes, juicios, fuegos celestiales y coronaciones.' }
];

export default function SimulacroBankManager({ onOpenImporter }) {
  // Pestaña de banco activa: 'personajes' | 'lugares' | 'cantidades' | 'eventos' | 'audit' (Ciencia de Datos)
  const [activeClass, setActiveClass] = useState('personajes');

  // Estado del Banco Desvinculado
  const [bank, setBank] = useState({ personajes: [], lugares: [], cantidades: [], eventos: [] });
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros de búsqueda para la clase activa
  const [searchQuery, setSearchQuery] = useState('');
  const [bookFilter, setBookFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  // Modales de Edición / Creación Rápida
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [isNewQuestionModalOpen, setIsNewQuestionModalOpen] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  // Formulario de edición/creación
  const [questionForm, setQuestionForm] = useState({
    class_id: 'personajes',
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'a',
    explanation: '',
    verse_reference: '',
    bookName: '1 Samuel',
    chapterNumber: 1,
    difficulty: 'medio'
  });

  // Cargar datos del banco al montar
  useEffect(() => {
    fetchBankData();

    const handleUpdated = () => fetchBankData(true);
    window.addEventListener('remanente-simulacro-questions-updated', handleUpdated);
    return () => window.removeEventListener('remanente-simulacro-questions-updated', handleUpdated);
  }, []);

  const fetchBankData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/simulacro/bank');
      if (res && res.success) {
        setBank(res.bank || { personajes: [], lugares: [], cantidades: [], eventos: [] });
        setMetrics(res.metrics || null);
      }
    } catch (err) {
      console.warn('Error cargando banco desvinculado de Simulacro:', err);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBankData(true);
  };

  // Abrir modal para crear una nueva pregunta en la clase actual
  const handleOpenCreateModal = (targetClass = activeClass) => {
    setQuestionForm({
      class_id: targetClass === 'audit' ? 'personajes' : targetClass,
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: 'Ninguna de las anteriores',
      option_d: 'Todas las anteriores',
      correct_answer: 'a',
      explanation: '',
      verse_reference: '',
      bookName: '1 Samuel',
      chapterNumber: 1,
      difficulty: 'medio'
    });
    setEditingQuestion(null);
    setIsNewQuestionModalOpen(true);
  };

  // Abrir modal para editar una pregunta existente
  const handleOpenEditModal = (q) => {
    setEditingQuestion(q);
    setQuestionForm({
      class_id: q.class_id || activeClass,
      question_text: q.question_text || '',
      option_a: q.option_a || '',
      option_b: q.option_b || '',
      option_c: q.option_c || 'Ninguna de las anteriores',
      option_d: q.option_d || 'Todas las anteriores',
      correct_answer: q.correct_answer || 'a',
      explanation: q.explanation || '',
      verse_reference: q.verse_reference || '',
      bookName: q.bookName || '1 Samuel',
      chapterNumber: q.chapterNumber || 1,
      difficulty: q.difficulty || 'medio'
    });
    setIsNewQuestionModalOpen(true);
  };

  // Guardar pregunta (creación o actualización)
  const handleSaveQuestionSubmit = async (e) => {
    e.preventDefault();
    if (!questionForm.question_text || !questionForm.option_a || !questionForm.option_b) {
      alert('Por favor ingresa al menos el enunciado y las opciones A y B.');
      return;
    }

    setSavingQuestion(true);
    setStatusMessage({ type: '', text: '' });

    try {
      const targetClass = questionForm.class_id;

      if (editingQuestion) {
        // Actualizar pregunta existente
        const res = await api.put(`/simulacro/bank/${targetClass}/questions/${editingQuestion.id}`, questionForm);
        if (res && res.success) {
          setStatusMessage({ type: 'success', text: '¡Pregunta actualizada exitosamente en el banco!' });
        }
      } else {
        // Crear nueva pregunta
        const res = await api.post(`/simulacro/bank/${targetClass}/questions`, questionForm);
        if (res && res.success) {
          setStatusMessage({ type: 'success', text: `¡Pregunta añadida al Banco de ${targetClass}!` });
        }
      }

      await fetchBankData(true);
      setIsNewQuestionModalOpen(false);
      setEditingQuestion(null);
    } catch (err) {
      console.error(err);
      alert('Error guardando en el banco: ' + (err.message || 'error interno'));
    } finally {
      setSavingQuestion(false);
    }
  };

  // Eliminar pregunta de un banco
  const handleDeleteQuestion = async (classId, questionId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta pregunta del banco de ' + classId + '?')) return;

    try {
      const res = await api.del(`/simulacro/bank/${classId}/questions/${questionId}`);
      if (res && res.success) {
        setStatusMessage({ type: 'success', text: 'Pregunta eliminada del banco.' });
        await fetchBankData(true);
      }
    } catch (err) {
      alert('Error eliminando pregunta: ' + err.message);
    }
  };

  // Exportar preguntas de la clase activa o de todo el banco a archivo .JSON
  const handleExportJSON = (exportAll = false) => {
    const dataToExport = exportAll 
      ? bank 
      : { class_id: activeClass, questions: bank[activeClass] || [] };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportAll 
      ? `simulacro_banco_completo_${Date.now()}.json` 
      : `simulacro_banco_${activeClass}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Restaurar a semilla verificada
  const handleResetToSeed = async () => {
    if (!window.confirm('¿Deseas restablecer el Banco de Simulacro a las 32 preguntas originales equilibradas?')) return;
    try {
      const res = await api.post('/simulacro/bank/reset-to-seed', {});
      if (res && res.success) {
        alert(res.message);
        await fetchBankData(true);
      }
    } catch (err) {
      alert('Error restableciendo banco: ' + err.message);
    }
  };

  // Preguntas de la clase activa filtradas
  const activeQuestions = bank[activeClass] || [];

  const filteredQuestions = useMemo(() => {
    return activeQuestions.filter(q => {
      const matchesSearch = !searchQuery || 
        q.question_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.verse_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.explanation?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesBook = bookFilter === 'all' || q.bookName === bookFilter;
      const matchesDifficulty = difficultyFilter === 'all' || q.difficulty === difficultyFilter;

      return matchesSearch && matchesBook && matchesDifficulty;
    });
  }, [activeQuestions, searchQuery, bookFilter, difficultyFilter]);

  const currentClassMeta = CLASSES.find(c => c.id === activeClass) || CLASSES[0];

  return (
    <div className="space-y-6 animate-fadeIn text-white">
      
      {/* ========================================================================= */}
      {/* CABECERA PRINCIPAL: BANCO DESVINCULADO Y ARQUITECTURA DE DATOS            */}
      {/* ========================================================================= */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-amber-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                <span>Almacén Desvinculado de Simulacro</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold">
                Arquitectura Estratificada (4 Clases)
              </span>
              {metrics && (
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1 ${
                  metrics.isBalanced 
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' 
                    : 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                }`}>
                  <Activity className="w-3.5 h-3.5" />
                  <span>Entropía: {metrics.equitability}% ({metrics.status})</span>
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black font-serif text-white tracking-tight">
              Bancos de Preguntas por Clase de Simulacro
            </h2>

            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Este almacén está <strong className="text-amber-300">completamente desacoplado</strong> de los quizzes de capítulos de la plataforma. Cada clase cuenta con su propio banco independiente para garantizar muestreo balanceado y no sesgado en las 4 competiciones.
            </p>
          </div>

          {/* Botones de Acción Global */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onOpenImporter && onOpenImporter(activeClass === 'audit' ? 'all' : activeClass)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-slate-950" />
              <span>Subir Preguntas / Importador</span>
            </button>

            <button
              onClick={() => handleOpenCreateModal()}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl text-xs sm:text-sm transition flex items-center gap-1.5 cursor-pointer"
              title="Añadir una pregunta manualmente"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Nueva Pregunta</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
              title="Sincronizar con Supabase Cloud"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tarjetas KPI de Ciencia de Datos: Conteo y Distribución Relativa */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-5 pt-5 border-t border-slate-800">
          
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Simulacro</span>
            <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
              {metrics?.total || 0}
            </div>
            <span className="text-[10px] text-slate-400">Preguntas activas</span>
          </div>

          {CLASSES.map(cls => {
            const count = bank[cls.id]?.length || 0;
            const pct = metrics?.percentages?.[cls.id] || 0;
            const isActive = activeClass === cls.id;

            return (
              <button
                key={cls.id}
                onClick={() => setActiveClass(cls.id)}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  isActive 
                    ? `${cls.bgColor} ${cls.borderColor} ring-1 ring-amber-400/50 shadow-md` 
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-sm">{cls.icon}</span>
                  <span className={`text-[10px] font-mono font-bold ${cls.textColor}`}>
                    {pct}%
                  </span>
                </div>
                <div className="text-lg font-black text-white font-mono mt-0.5">
                  {count}
                </div>
                <span className="text-[10px] font-medium text-slate-400 block truncate">
                  {cls.name}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => setActiveClass('audit')}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              activeClass === 'audit'
                ? 'bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-400/50'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-sm">📊</span>
              <span className="text-[10px] font-bold text-amber-300">Auditoría</span>
            </div>
            <div className="text-lg font-black text-amber-400 font-mono mt-0.5">
              {metrics?.equitability || 100}%
            </div>
            <span className="text-[10px] font-medium text-slate-400 block truncate">
              Salud Muestral
            </span>
          </button>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* SELECTOR DE PESTAÑAS DE BANCO                                             */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto scrollbar-thin">
        {CLASSES.map(cls => {
          const isSelected = activeClass === cls.id;
          const count = bank[cls.id]?.length || 0;

          return (
            <button
              key={cls.id}
              onClick={() => setActiveClass(cls.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold border flex items-center gap-2.5 transition shrink-0 cursor-pointer ${
                isSelected
                  ? `${cls.bgColor} ${cls.borderColor} ${cls.textColor} ring-1 ring-amber-400/40 shadow-lg`
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <span className="text-base">{cls.icon}</span>
              <span>{cls.fullName}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}

        <button
          onClick={() => setActiveClass('audit')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold border flex items-center gap-2 transition shrink-0 cursor-pointer ${
            activeClass === 'audit'
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 ring-1 ring-amber-400/40 shadow-lg'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-400" />
          <span>Ciencia de Datos & Distribución</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: EXPLORADOR DEL BANCO DE LA CLASE ACTIVA                          */}
      {/* ========================================================================= */}
      {activeClass !== 'audit' && (
        <div className="space-y-4">
          
          {/* Barra de Descripción y Controles del Banco de Clase */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${currentClassMeta.bgColor} ${currentClassMeta.textColor} text-xl`}>
                {currentClassMeta.icon}
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{currentClassMeta.fullName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                    {activeQuestions.length} preguntas en este banco
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  {currentClassMeta.desc}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleOpenCreateModal(activeClass)}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir a {currentClassMeta.name}</span>
              </button>

              <button
                onClick={() => onOpenImporter && onOpenImporter(activeClass)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Importar a {currentClassMeta.name}</span>
              </button>

              <button
                onClick={() => handleExportJSON(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                title="Exportar esta clase en .JSON"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Barra de Búsqueda y Filtros */}
          <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 ml-1" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Buscar en el Banco de ${currentClassMeta.name}...`}
                className="w-full bg-transparent text-white placeholder:text-slate-500 focus:outline-none text-xs"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-700">
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <select
                  value={bookFilter}
                  onChange={(e) => setBookFilter(e.target.value)}
                  className="bg-transparent text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">Todos los libros</option>
                  <option value="1 Samuel">1 Samuel</option>
                  <option value="2 Samuel">2 Samuel</option>
                  <option value="1 Reyes">1 Reyes</option>
                  <option value="2 Reyes">2 Reyes</option>
                </select>
              </div>

              <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-700">
                <Filter className="w-3.5 h-3.5 text-blue-400" />
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="bg-transparent text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">Todas las dificultades</option>
                  <option value="fácil">Fácil</option>
                  <option value="medio">Medio</option>
                  <option value="difícil">Difícil</option>
                </select>
              </div>

              <span className="text-slate-400 text-[11px]">
                Mostrando <strong className="text-amber-300 font-mono">{filteredQuestions.length}</strong> de <strong className="text-slate-200 font-mono">{activeQuestions.length}</strong>
              </span>
            </div>
          </div>

          {/* Lista de Preguntas del Banco */}
          {filteredQuestions.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 rounded-3xl border border-dashed border-slate-800 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <Database className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">
                {activeQuestions.length === 0 
                  ? `El Banco de ${currentClassMeta.name} está vacío` 
                  : 'No se encontraron preguntas con los filtros aplicados'}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Puedes añadir preguntas directamente a este banco o importar un archivo de preguntas en cualquier formato.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => handleOpenCreateModal(activeClass)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir Pregunta</span>
                </button>
                <button
                  onClick={() => onOpenImporter && onOpenImporter(activeClass)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span>Importar Lote</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredQuestions.map((q, idx) => (
                <div 
                  key={q.id || idx} 
                  className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-3 relative group shadow-sm"
                >
                  {/* Cabecera de la Pregunta */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px] border border-amber-500/30">
                        #{idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-bold text-[10px]">
                        {q.bookName} • Cap. {q.chapterNumber}
                      </span>
                      {q.difficulty && (
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          q.difficulty === 'fácil' ? 'bg-emerald-500/20 text-emerald-300' :
                          q.difficulty === 'difícil' ? 'bg-red-500/20 text-red-300' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {q.difficulty}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(q)}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                        title="Editar pregunta"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(activeClass, q.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition cursor-pointer"
                        title="Eliminar del banco"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Enunciado */}
                  <p className="text-sm font-bold text-white leading-snug">
                    {q.question_text}
                  </p>

                  {/* 4 Opciones */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs pt-1">
                    <div className={`p-1.5 rounded-xl border flex items-center gap-1.5 ${
                      q.correct_answer === 'a' 
                        ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200 font-bold' 
                        : 'bg-slate-900/80 border-slate-800/80 text-slate-300'
                    }`}>
                      <span className={`w-4 h-4 rounded-md font-mono text-[10px] flex items-center justify-center font-bold ${
                        q.correct_answer === 'a' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}>A</span>
                      <span className="truncate">{q.option_a}</span>
                    </div>

                    <div className={`p-1.5 rounded-xl border flex items-center gap-1.5 ${
                      q.correct_answer === 'b' 
                        ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200 font-bold' 
                        : 'bg-slate-900/80 border-slate-800/80 text-slate-300'
                    }`}>
                      <span className={`w-4 h-4 rounded-md font-mono text-[10px] flex items-center justify-center font-bold ${
                        q.correct_answer === 'b' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}>B</span>
                      <span className="truncate">{q.option_b}</span>
                    </div>

                    <div className={`p-1.5 rounded-xl border flex items-center gap-1.5 ${
                      q.correct_answer === 'c' 
                        ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200 font-bold' 
                        : 'bg-slate-900/80 border-slate-800/80 text-slate-300'
                    }`}>
                      <span className={`w-4 h-4 rounded-md font-mono text-[10px] flex items-center justify-center font-bold ${
                        q.correct_answer === 'c' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}>C</span>
                      <span className="truncate">{q.option_c}</span>
                    </div>

                    <div className={`p-1.5 rounded-xl border flex items-center gap-1.5 ${
                      q.correct_answer === 'd' 
                        ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200 font-bold' 
                        : 'bg-slate-900/80 border-slate-800/80 text-slate-300'
                    }`}>
                      <span className={`w-4 h-4 rounded-md font-mono text-[10px] flex items-center justify-center font-bold ${
                        q.correct_answer === 'd' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}>D</span>
                      <span className="truncate">{q.option_d}</span>
                    </div>
                  </div>

                  {/* Cita y Explicación */}
                  {(q.verse_reference || q.explanation) && (
                    <div className="pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-1.5">
                      {q.verse_reference && (
                        <span className="font-semibold text-amber-300 flex items-center gap-1">
                          📖 {q.verse_reference}
                        </span>
                      )}
                      {q.explanation && (
                        <span className="italic truncate max-w-xs text-slate-400">
                          💡 {q.explanation}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: AUDITORÍA DE CIENCIA DE DATOS & DISTRIBUCIÓN ESTRATIFICADA       */}
      {/* ========================================================================= */}
      {activeClass === 'audit' && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold font-serif text-white">
                  Auditoría de Ciencia de Datos & Distribución Estratificada
                </h3>
                <p className="text-xs text-slate-400">
                  Análisis cuantitativo de la varianza muestral, entropía informacional y cuotas por estrato.
                </p>
              </div>
            </div>

            {/* Fórmulas y Diagnóstico */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Entropía de Shannon (H)</span>
                <div className="text-2xl font-black text-amber-300 font-mono">
                  {metrics?.entropy || 0} <span className="text-xs text-slate-400 font-normal">/ 2.00 bits</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Mide la dispersión informativa entre los 4 bancos bíblicos.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Equitabilidad Muestral (η)</span>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {metrics?.equitability || 100}%
                </div>
                <p className="text-[11px] text-slate-400">
                  Proporción de uniformidad respecto al óptimo de 25% por clase.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Cuota Ideal por Clase</span>
                <div className="text-2xl font-black text-blue-400 font-mono">
                  ~{metrics?.idealPerClass || 0} <span className="text-xs text-slate-400 font-normal">preguntas c/u</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Equilibrio estricto para las competencias de Simulacro.
                </p>
              </div>
            </div>

            {/* Barras Comparativas de Distribución */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Distribución Relativa por Estrato
              </h4>

              {CLASSES.map(cls => {
                const count = bank[cls.id]?.length || 0;
                const pct = metrics?.percentages?.[cls.id] || 0;
                const isOptimal = pct >= 20 && pct <= 30;

                return (
                  <div key={cls.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold flex items-center gap-1.5">
                        <span>{cls.icon}</span>
                        <span>{cls.fullName}</span>
                      </span>
                      <span className="font-mono text-slate-300">
                        <strong className="text-white">{count}</strong> preguntas ({pct}%)
                      </span>
                    </div>

                    <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 relative">
                      <div 
                        className={`h-full bg-gradient-to-r ${cls.color} transition-all duration-500 rounded-full`}
                        style={{ width: `${Math.min(100, pct * 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Acciones de Mantenimiento */}
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                ¿Deseas restaurar la semilla inicial equilibrada de 32 preguntas bíblicas verificadas?
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportJSON(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Banco Completo (.json)</span>
                </button>

                <button
                  onClick={handleResetToSeed}
                  className="px-3.5 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Restaurar Semilla Equilibrada (32 Qs)
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL PARA CREAR O EDITAR PREGUNTA INDIVIDUAL EN CUALQUIER BANCO          */}
      {/* ========================================================================= */}
      {isNewQuestionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden">
            
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold font-serif text-white">
                    {editingQuestion ? 'Editar Pregunta del Banco' : 'Nueva Pregunta en Banco Desvinculado'}
                  </h3>
                  <span className="text-xs text-slate-400">
                    Se almacena directamente en el banco de Simulacro
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsNewQuestionModalOpen(false)}
                className="p-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestionSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Clase Bíblica:</label>
                  <select
                    value={questionForm.class_id}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, class_id: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                  >
                    <option value="personajes">👤 Personajes</option>
                    <option value="lugares">📍 Lugares</option>
                    <option value="cantidades">🔢 Cantidades</option>
                    <option value="eventos">⚡ Eventos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Libro Bíblico:</label>
                  <select
                    value={questionForm.bookName}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, bookName: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="1 Samuel">1 Samuel</option>
                    <option value="2 Samuel">2 Samuel</option>
                    <option value="1 Reyes">1 Reyes</option>
                    <option value="2 Reyes">2 Reyes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Capítulo:</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={questionForm.chapterNumber}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, chapterNumber: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Enunciado de la Pregunta:</label>
                <textarea
                  value={questionForm.question_text}
                  onChange={(e) => setQuestionForm(prev => ({ ...prev, question_text: e.target.value }))}
                  placeholder="¿En qué monte derrotó Elías a los profetas de Baal?"
                  required
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Opción A (Requerida):</label>
                  <input
                    type="text"
                    value={questionForm.option_a}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, option_a: e.target.value }))}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Opción B (Requerida):</label>
                  <input
                    type="text"
                    value={questionForm.option_b}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, option_b: e.target.value }))}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Opción C:</label>
                  <input
                    type="text"
                    value={questionForm.option_c}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, option_c: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Opción D:</label>
                  <input
                    type="text"
                    value={questionForm.option_d}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, option_d: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Opción Correcta:</label>
                  <select
                    value={questionForm.correct_answer}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, correct_answer: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                  >
                    <option value="a">Opción A</option>
                    <option value="b">Opción B</option>
                    <option value="c">Opción C</option>
                    <option value="d">Opción D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Dificultad:</label>
                  <select
                    value={questionForm.difficulty}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, difficulty: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="fácil">Fácil</option>
                    <option value="medio">Medio</option>
                    <option value="difícil">Difícil</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Cita Bíblica:</label>
                  <input
                    type="text"
                    value={questionForm.verse_reference}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, verse_reference: e.target.value }))}
                    placeholder="1 Reyes 18:20"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Explicación Oficial:</label>
                <input
                  type="text"
                  value={questionForm.explanation}
                  onChange={(e) => setQuestionForm(prev => ({ ...prev, explanation: e.target.value }))}
                  placeholder="Fuego de Dios cayó sobre el altar empapado"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewQuestionModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savingQuestion}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                >
                  {savingQuestion ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingQuestion ? 'Guardar Cambios' : 'Añadir al Banco'}</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
