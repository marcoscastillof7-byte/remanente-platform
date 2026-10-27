import { useState, useEffect } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, HelpCircle, FileText, Sparkles, Layers, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';

const FIRE_CATEGORIES = [
  { id: 'personajes', name: 'Personajes', icon: '👤', color: 'text-blue-400', border: 'border-blue-500/40', bg: 'bg-blue-500/10' },
  { id: 'lugares', name: 'Lugares', icon: '📍', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' },
  { id: 'cantidades', name: 'Cantidades', icon: '🔢', color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10' },
  { id: 'eventos', name: 'Eventos', icon: '⚡', color: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-500/10' }
];

export default function FireQuestionsImporterModal({ isOpen, onClose, onImportSuccess }) {
  const [selectedCategory, setSelectedCategory] = useState('personajes');
  const [inputMode, setInputMode] = useState('text'); // 'text' | 'form' | 'json'
  const [inputText, setInputText] = useState('');
  const [stats, setStats] = useState({ personajes: 0, lugares: 0, cantidades: 0, eventos: 0, total: 0 });
  const [loadingStats, setLoadingStats] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [parseError, setParseError] = useState('');
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  // Formulario manual individual
  const [singleForm, setSingleForm] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'a',
    explanation: '',
    verse_reference: ''
  });

  // Cargar estadísticas de conteo
  useEffect(() => {
    if (isOpen) {
      fetchStats();
      setImportSuccessMsg('');
      setParseError('');
    }
  }, [isOpen]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.get('/simulacro/questions/fire-questions/stats');
      if (res && res.stats) {
        setStats(res.stats);
      }
    } catch (e) {
      console.warn('Error cargando estadísticas:', e);
    } finally {
      setLoadingStats(false);
    }
  };

  // Parser inteligente de texto a preguntas estructuradas
  const parseTextInput = (raw) => {
    setParseError('');
    if (!raw.trim()) {
      setPreviewQuestions([]);
      return;
    }

    try {
      // 1. Si parece JSON
      if (raw.trim().startsWith('[') || raw.trim().startsWith('{')) {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        setPreviewQuestions(list);
        return;
      }

      // 2. Parser de bloques de texto
      // Separa por bloques vacíos o palabras clave "Pregunta" / números
      const blocks = raw.split(/\n\s*\n/).filter(b => b.trim());
      const parsedList = [];

      for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l);
        let qText = '';
        let optA = '', optB = '', optC = '', optD = '';
        let correct = 'a';
        let explanation = '';
        let verse = '';

        for (const line of lines) {
          const lLower = line.toLowerCase();
          if (lLower.startsWith('pregunta:') || lLower.startsWith('p:')) {
            qText = line.substring(line.indexOf(':') + 1).trim();
          } else if (lLower.startsWith('a:') || lLower.startsWith('a)')) {
            optA = line.substring(2).trim();
          } else if (lLower.startsWith('b:') || lLower.startsWith('b)')) {
            optB = line.substring(2).trim();
          } else if (lLower.startsWith('c:') || lLower.startsWith('c)')) {
            optC = line.substring(2).trim();
          } else if (lLower.startsWith('d:') || lLower.startsWith('d)')) {
            optD = line.substring(2).trim();
          } else if (lLower.startsWith('correcta:') || lLower.startsWith('respuesta:') || lLower.startsWith('r:')) {
            const rawCorr = line.substring(line.indexOf(':') + 1).trim().toLowerCase();
            if (['a', 'b', 'c', 'd'].includes(rawCorr[0])) {
              correct = rawCorr[0];
            }
          } else if (lLower.startsWith('explicación:') || lLower.startsWith('explicacion:') || lLower.startsWith('exp:')) {
            explanation = line.substring(line.indexOf(':') + 1).trim();
          } else if (lLower.startsWith('referencia:') || lLower.startsWith('versículo:') || lLower.startsWith('ref:')) {
            verse = line.substring(line.indexOf(':') + 1).trim();
          } else if (!qText) {
            // Primera línea como texto de la pregunta si no tiene prefijo
            qText = line.replace(/^\d+[\.\-\)]\s*/, '');
          }
        }

        if (qText && optA && optB) {
          parsedList.push({
            question_text: qText,
            option_a: optA,
            option_b: optB,
            option_c: optC || 'Ninguna de las anteriores',
            option_d: optD || 'Todas las anteriores',
            correct_answer: correct,
            explanation: explanation || 'Respuesta bíblica oficial NTV.',
            verse_reference: verse
          });
        }
      }

      setPreviewQuestions(parsedList);
      if (parsedList.length === 0 && raw.trim().length > 20) {
        setParseError('No se pudieron identificar las preguntas. Asegúrate de incluir el texto de la pregunta y las opciones A: y B:.');
      }
    } catch (err) {
      setParseError('Error interpretando el formato: ' + err.message);
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setInputText(val);
    parseTextInput(val);
  };

  const handleSingleFormSubmit = (e) => {
    e.preventDefault();
    if (!singleForm.question_text || !singleForm.option_a || !singleForm.option_b) {
      alert('Debes ingresar al menos el enunciado y las opciones A y B.');
      return;
    }
    setPreviewQuestions([singleForm]);
  };

  // Enviar preguntas al servidor para importarlas en la categoría seleccionada
  const handleExecuteImport = async () => {
    if (previewQuestions.length === 0) return;
    setSubmitting(true);
    setImportSuccessMsg('');

    try {
      const res = await api.post('/simulacro/questions/fire-questions/import', {
        category: selectedCategory,
        questions: previewQuestions
      });

      if (res && res.success) {
        setImportSuccessMsg(`¡${res.importedCount} preguntas importadas con éxito a "${selectedCategory.toUpperCase()}"! Total ahora: ${res.totalInCategory}`);
        setInputText('');
        setPreviewQuestions([]);
        setSingleForm({
          question_text: '',
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
          correct_answer: 'a',
          explanation: '',
          verse_reference: ''
        });
        await fetchStats();
        if (onImportSuccess) onImportSuccess(selectedCategory, res.importedCount);
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error al importar las preguntas.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentCatObj = FIRE_CATEGORIES.find(c => c.id === selectedCategory) || FIRE_CATEGORIES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Fire Questions Importer
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">Por Subcategorías</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-serif text-white">
                Importador de Preguntas Oficiales
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de las 5 Subcategorías con Estadísticas */}
        <div className="p-3 sm:p-4 bg-slate-950/70 border-b border-slate-800 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {FIRE_CATEGORIES.map(cat => {
              const isSelected = selectedCategory === cat.id;
              const count = stats[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition cursor-pointer ${
                    isSelected
                      ? `${cat.bg} ${cat.border} ${cat.color} ring-1 ring-amber-400/50 shadow-md`
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span className="text-base">{cat.icon}</span>
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

        {/* Contenido Principal con Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Mensaje de Éxito si aplica */}
          {importSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{importSuccessMsg}</span>
            </div>
          )}

          {/* Selector de Modo de Entrada: Pegar Texto vs Formulario Directo */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs uppercase font-bold text-slate-400">
              Destino: <strong className={currentCatObj.color}>{currentCatObj.icon} {currentCatObj.name}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  inputMode === 'text' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Pegar Texto / Lote
              </button>
              <button
                type="button"
                onClick={() => setInputMode('form')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  inputMode === 'form' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Formulario Manual
              </button>
            </div>
          </div>

          {/* MODO 1: PEGAR TEXTO / BLOQUE */}
          {inputMode === 'text' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Pega aquí una o varias preguntas en formato estándar o JSON:</span>
                <span className="text-amber-400 font-mono text-[11px]">
                  {previewQuestions.length} pregunta(s) detectada(s)
                </span>
              </div>

              <textarea
                value={inputText}
                onChange={handleTextChange}
                placeholder={`Ejemplo de formato:\n\nPregunta: ¿Cómo se llamaba el padre del rey Saúl?\nA: Cis\nB: Elí\nC: Isaí\nD: Abner\nCorrecta: A\nExplicación: Saúl era hijo de Cis, benjamita.\nReferencia: 1 Samuel 9:1\n\n(Puedes pegar múltiples preguntas separadas por una línea en blanco)`}
                rows={7}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl p-3.5 text-xs sm:text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-400/80 transition resize-y leading-relaxed"
              />

              {parseError && (
                <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {/* MODO 2: FORMULARIO INDIVIDUAL MANUAL */}
          {inputMode === 'form' && (
            <form onSubmit={handleSingleFormSubmit} className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
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
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Referencia Bíblica:</label>
                  <input
                    type="text"
                    value={singleForm.verse_reference}
                    onChange={(e) => setSingleForm(prev => ({ ...prev, verse_reference: e.target.value }))}
                    placeholder="1 Reyes 18:20"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Explicación:</label>
                  <input
                    type="text"
                    value={singleForm.explanation}
                    onChange={(e) => setSingleForm(prev => ({ ...prev, explanation: e.target.value }))}
                    placeholder="Fuego cayó del cielo consumiendo el holocausto"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-bold text-white transition cursor-pointer"
              >
                Cargar al Preview de Importación
              </button>
            </form>
          )}

          {/* PREVIEW DE PREGUNTAS LISTAS PARA IMPORTAR */}
          {previewQuestions.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Preguntas Listas para Guardar ({previewQuestions.length}):</span>
                </span>
                <span className="text-[11px] text-amber-300 font-bold">
                  Se asignarán a: {currentCatObj.name}
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {previewQuestions.map((q, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-white leading-snug">
                        {idx + 1}. {q.question_text}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase font-bold text-[10px] shrink-0">
                        Respuesta: {q.correct_answer}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400">
                      <span>A) {q.option_a}</span>
                      <span>B) {q.option_b}</span>
                      {q.option_c && <span>C) {q.option_c}</span>}
                      {q.option_d && <span>D) {q.option_d}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer con Botones de Acción */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={submitting || previewQuestions.length === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Importando...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Importar {previewQuestions.length} Pregunta(s) a {currentCatObj.name}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
