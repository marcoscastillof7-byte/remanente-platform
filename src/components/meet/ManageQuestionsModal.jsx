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
  Award,
  Sparkles,
  Save
} from 'lucide-react';
import { api } from '../../utils/api';
import { parseQuestionsText } from '../../utils/questionParser';

const ManageQuestionsModal = ({ 
  isOpen, 
  onClose, 
  meet, 
  onSaved 
}) => {
  const [questions, setQuestions] = useState([]);
  const [bulkText, setBulkText] = useState('');
  const [importMode, setImportMode] = useState('append'); // 'append' | 'replace'
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingBank, setLoadingBank] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState('');
  const [bulkErrorMessage, setBulkErrorMessage] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && meet?.id) {
      loadMeetingQuestions();
    }
  }, [isOpen, meet?.id]);

  const loadMeetingQuestions = async () => {
    setLoadingInitial(true);
    setError(null);
    setBulkSuccessMessage('');
    setBulkErrorMessage('');
    try {
      const data = await api.get(`/meetings/${meet.id}`);
      if (data && Array.isArray(data.questions)) {
        setQuestions(data.questions);
      } else {
        setQuestions([]);
      }
    } catch (err) {
      console.error('Error cargando preguntas del meet:', err);
      setError('No se pudieron cargar las preguntas actuales del Meet.');
      setQuestions([]);
    } finally {
      setLoadingInitial(false);
    }
  };

  // Procesar e importar texto pegado
  const handleProcessBulkImport = () => {
    setBulkSuccessMessage('');
    setBulkErrorMessage('');

    if (!bulkText.trim()) {
      setBulkErrorMessage('Por favor pega el texto de las preguntas o selecciona un archivo .txt');
      return;
    }

    const parsed = parseQuestionsText(bulkText);
    if (parsed.length === 0) {
      setBulkErrorMessage('No se reconocieron preguntas con formato válido. Asegúrate de incluir PREGUNTA:, A., B., C., D. y RESPUESTA:.');
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

  // Subir archivo .txt con auto-parseo inmediato
  const handleQuestionsTxtUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBulkSuccessMessage('');
    setBulkErrorMessage('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setBulkText(content);

      // Auto-parsear inmediatamente para dar respuesta instantánea
      const parsed = parseQuestionsText(content);
      if (parsed.length > 0) {
        if (importMode === 'replace') {
          setQuestions(parsed);
        } else {
          setQuestions(prev => [...prev, ...parsed]);
        }
        setBulkSuccessMessage(`¡${parsed.length} preguntas reconocidas e importadas desde "${file.name}"!`);
        setBulkText('');
      } else {
        setBulkErrorMessage(`El archivo "${file.name}" fue cargado, pero no se detectaron preguntas con formato estándar.`);
      }
    };
    reader.readAsText(file);
    // Limpiar input file para permitir seleccionar el mismo archivo
    e.target.value = '';
  };

  // Cargar preguntas desde el banco bíblico oficial para los capítulos de este meet
  const handleLoadFromBank = async () => {
    setLoadingBank(true);
    setBulkSuccessMessage('');
    setBulkErrorMessage('');

    try {
      const res = await api.post('/meetings/generate-questions', {
        bookId: meet.bookId,
        chapterIds: meet.chaptersSelected || [],
        questionCount: 15,
        difficulty: 'medio'
      });

      if (res && res.questions && Array.isArray(res.questions) && res.questions.length > 0) {
        if (importMode === 'replace') {
          setQuestions(res.questions);
        } else {
          setQuestions(prev => [...prev, ...res.questions]);
        }
        setBulkSuccessMessage(`¡${res.questions.length} preguntas bíblicas añadidas desde el banco de estudio!`);
      } else {
        alert('No se encontraron preguntas en el banco para los capítulos de este meet.');
      }
    } catch (err) {
      console.error(err);
      alert('Error cargando preguntas del banco bíblico.');
    } finally {
      setLoadingBank(false);
    }
  };

  // Insertar plantilla de ejemplo oficial
  const insertTemplateExample = () => {
    const template = `PREGUNTA: ¿Quién fue el primer rey ungido de Israel?
A. David
B. Saúl
C. Salomón
D. Samuel
RESPUESTA: B
EXPLICACION: Saúl, hijo de Cis de la tribu de Benjamín, fue ungido por el profeta Samuel.
VERSICULO: 1 Samuel 10:1

PREGUNTA: ¿Con qué instrumento derrotó David al gigante Goliat?
A. Una espada de bronce forjado
B. Una lanza y escudo
C. Una honda y una piedra lisa
D. Un arco con saetas
RESPUESTA: C
EXPLICACION: David confió en Jehová de los ejércitos y con su honda hirió a Goliat en la frente.
VERSICULO: 1 Samuel 17:49`;

    setBulkText(template);
    setBulkSuccessMessage('Plantilla de ejemplo copiada. Puedes editarla o pulsar "Procesar e Importar".');
  };

  // Añadir una pregunta manual
  const handleAddManualQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        id: `manual_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        question_text: '¿Nueva pregunta bíblica?',
        option_a: 'Opción A',
        option_b: 'Opción B',
        option_c: 'Opción C',
        option_d: 'Opción D',
        correct_answer: 'a',
        explanation: 'Explicación del pasaje bíblico',
        verse_reference: '',
        time_limit_seconds: 25
      }
    ]);
  };

  const handleRemoveQuestion = (idx) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  // Guardar en el backend
  const handleSaveQuestions = async () => {
    if (!meet?.id) return;
    setSaving(true);
    setError(null);

    try {
      const res = await api.put(`/meetings/${meet.id}/questions`, { questions });
      if (res && res.success) {
        if (onSaved) {
          onSaved(res.questions || questions);
        }
        onClose();
      } else {
        throw new Error(res?.error || 'No se pudieron guardar las preguntas');
      }
    } catch (err) {
      console.error('Error guardando preguntas en meet:', err);
      setError(err.message || 'Error al guardar las preguntas');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !meet) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gold/40 w-full max-w-4xl my-2 sm:my-8 overflow-hidden flex flex-col max-h-[95dvh] sm:max-h-[92vh]">
        
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-primary-dark via-primary to-primary-dark text-white p-4 sm:p-5 border-b border-gold/40 flex justify-between items-center shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 bg-gold/20 text-gold-light border border-gold/40 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                <Award className="w-3.5 h-3.5 text-gold" />
                <span>Gestión de Preguntas Bíblicas</span>
              </span>
              <span className="text-[11px] sm:text-xs bg-white/10 px-2.5 py-0.5 rounded-full font-bold text-gray-200">
                {questions.length} {questions.length === 1 ? 'pregunta' : 'preguntas'}
              </span>
            </div>
            <h2 className="font-[Cinzel] text-lg sm:text-xl font-bold text-white truncate max-w-xl">
              📖 {meet.title}
            </h2>
            {meet.bookName && (
              <p className="text-[11px] sm:text-xs text-gray-300">
                Libro: <strong>{meet.bookName}</strong> {meet.chaptersSelected?.length > 0 && `• ${meet.chaptersSelected.length} capítulos`}
              </p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-300 hover:text-white p-1.5 sm:p-2 rounded-lg hover:bg-white/10 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs sm:text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {loadingInitial ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
              <Loader className="w-8 h-8 animate-spin text-gold" />
              <p className="text-xs sm:text-sm">Cargando preguntas de la reunión...</p>
            </div>
          ) : (
            <>
              {/* PANEL DE IMPORTACIÓN MASIVA (Método Idéntico al Oficial de Quizzes) */}
              <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/60 border border-blue-200 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/60 pb-2.5">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs sm:text-sm">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Importador Masivo de Preguntas para esta Reunión</span>
                  </div>

                  {/* Acciones Rápidas */}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold bg-white border border-gray-300 hover:border-gold px-2.5 py-1 rounded-lg shadow-2xs text-gray-700 hover:text-gold-dark transition-all">
                      <Upload className="w-3.5 h-3.5 text-gold" />
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
                      className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white border border-gray-300 hover:border-blue-400 px-2.5 py-1 rounded-lg shadow-2xs text-gray-700 hover:text-blue-700 transition-all"
                    >
                      <span>Plantilla Ejemplo 📝</span>
                    </button>

                    <button
                      type="button"
                      disabled={loadingBank}
                      onClick={handleLoadFromBank}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded-lg shadow-2xs text-amber-900 transition-all disabled:opacity-50"
                      title="Carga preguntas oficiales de los capítulos de este meet"
                    >
                      {loadingBank ? (
                        <>
                          <Loader className="w-3 h-3 animate-spin text-amber-800" />
                          <span>Cargando...</span>
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-3.5 h-3.5 text-amber-800" />
                          <span>Cargar del Banco Bíblico 🏛️</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Textarea */}
                <div>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={4}
                    placeholder={`Pega aquí tus preguntas bíblicas con formato estándar o JSON:\n\nPREGUNTA: ¿Texto de la pregunta?\nA. Opción A\nB. Opción B\nC. Opción C\nD. Opción D\nRESPUESTA: A\nEXPLICACION: Explicación bíblica del texto (opcional)\nVERSICULO: 1 Samuel 17:45 (opcional)`}
                    className="w-full px-3.5 py-2.5 border border-blue-200 rounded-lg text-xs font-mono bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Admite prefijos <code className="text-blue-700">PREGUNTA:</code>, preguntas numeradas (<code className="text-blue-700">1.</code>, <code className="text-blue-700">2.</code>), archivos de texto <code className="text-blue-700">.txt</code>, o formato <code className="text-blue-700">JSON</code>.
                  </p>
                </div>

                {/* Modo de Importación & Botón */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-blue-200/60">
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 font-medium">
                      <input
                        type="radio"
                        name="importModeQuestions"
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
                        name="importModeQuestions"
                        value="replace"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-red-600 focus:ring-red-500"
                      />
                      <span>Reemplazar todas las preguntas</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleProcessBulkImport}
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Procesar e Importar Preguntas</span>
                  </button>
                </div>

                {/* Mensajes de Éxito y Advertencia */}
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

              {/* LISTA Y PREVISUALIZACIÓN DE PREGUNTAS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-[Cinzel] font-bold text-sm sm:text-base text-primary">
                      Preguntas de la Reunión ({questions.length})
                    </h3>
                    {questions.length === 0 && (
                      <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                        ⚠️ Sin preguntas cargadas
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddManualQuestion}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Manual</span>
                  </button>
                </div>

                {questions.length === 0 ? (
                  <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center space-y-2 bg-gray-50/70">
                    <FileText className="w-10 h-10 text-gray-400 mx-auto" />
                    <h4 className="font-bold text-gray-700 text-sm">No hay preguntas cargadas en este Meet</h4>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      Pega un texto de preguntas arriba, sube un archivo .txt o haz clic en <strong>"Cargar del Banco Bíblico"</strong> para importar preguntas al instante.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {questions.map((q, idx) => (
                      <div key={q.id || idx} className="p-3.5 border border-gray-200 rounded-xl bg-white shadow-xs relative group hover:border-gold/60 transition-all">
                        <div className="flex justify-between items-start gap-2">
                          <div className="font-semibold text-xs sm:text-sm text-gray-900 flex items-start gap-2 min-w-0">
                            <span className="w-5 h-5 bg-gold/20 text-gold-dark rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-snug">{q.question_text}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(idx)}
                            className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors shrink-0"
                            title="Eliminar pregunta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5 text-[11px]">
                          {['a', 'b', 'c', 'd'].map(optKey => {
                            const optText = q[`option_${optKey}`];
                            if (!optText) return null;
                            const isCorrect = String(q.correct_answer || '').toLowerCase() === optKey;
                            return (
                              <div 
                                key={optKey} 
                                className={`p-1.5 px-2 rounded-lg border flex items-center gap-1.5 ${
                                  isCorrect 
                                    ? 'bg-green-50 border-green-300 font-bold text-green-900' 
                                    : 'bg-gray-50 border-gray-200 text-gray-600'
                                }`}
                              >
                                <span className={`w-4 h-4 rounded text-[10px] flex items-center justify-center font-bold uppercase ${
                                  isCorrect ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {optKey}
                                </span>
                                <span className="truncate">{optText}</span>
                              </div>
                            );
                          })}
                        </div>

                        {(q.verse_reference || q.explanation) && (
                          <div className="mt-2 text-[10px] text-gray-500 pt-1.5 border-t border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {q.verse_reference && (
                              <span className="text-gold-dark font-semibold italic">
                                📖 {q.verse_reference}
                              </span>
                            )}
                            {q.explanation && (
                              <span className="text-gray-600 line-clamp-1">
                                • {q.explanation}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
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

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveQuestions}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white rounded-lg text-xs sm:text-sm font-bold shadow-md transition-all disabled:opacity-50 text-center cursor-pointer"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin text-white" />
                <span>Guardando en el Meet...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Preguntas en esta Reunión ({questions.length}) 💾</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ManageQuestionsModal;
