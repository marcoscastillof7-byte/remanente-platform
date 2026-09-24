import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { api } from '../../utils/api';
import { Plus, Edit, Trash2, Loader, Save, X, FileText, CheckCircle } from 'lucide-react';

const QuestionManager = () => {
  const { chapterId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkMode, setBulkMode] = useState('append');
  const [bulkLoading, setBulkLoading] = useState(false);

  const [form, setForm] = useState({
    question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
    correct_answer: 'a', difficulty: 'medio', explanation: '', verse_reference: ''
  });

  useEffect(() => {
    fetchQuestions();
  }, [chapterId]);

  const fetchQuestions = async () => {
    try {
      const data = await api.get(`/admin/questions/${chapterId}`);
      setQuestions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
      correct_answer: 'a', difficulty: 'medio', explanation: '', verse_reference: ''
    });
  };

  const handleAdd = async () => {
    try {
      await api.post('/admin/questions', { ...form, chapter_id: parseInt(chapterId) });
      resetForm();
      setShowAdd(false);
      fetchQuestions();
    } catch (err) {
      console.error(err);
      alert('Error creando la pregunta.');
    }
  };

  const handleBulkSubmit = async () => {
    if (!bulkText.trim()) return alert('El texto está vacío');
    setBulkLoading(true);
    try {
      // Parsear el texto
      const blocks = bulkText.split(/PREGUNTA:/i).filter(b => b.trim().length > 0);
      const parsedQuestions = blocks.map(block => {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const question_text = lines[0];
        let option_a = '', option_b = '', option_c = '', option_d = '';
        let correct_answer = 'a', explanation = '', verse_reference = '';
        
        lines.slice(1).forEach(line => {
            const upperLine = line.toUpperCase();
            if (upperLine.startsWith('A.')) option_a = line.substring(2).trim();
            else if (upperLine.startsWith('B.')) option_b = line.substring(2).trim();
            else if (upperLine.startsWith('C.')) option_c = line.substring(2).trim();
            else if (upperLine.startsWith('D.')) option_d = line.substring(2).trim();
            else if (upperLine.startsWith('RESPUESTA:')) correct_answer = line.split(':')[1].trim().toLowerCase();
            else if (upperLine.startsWith('EXPLICACION:')) explanation = line.substring(12).trim();
            else if (upperLine.startsWith('VERSICULO:')) verse_reference = line.substring(10).trim();
        });

        return { question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, verse_reference, difficulty: 'medio' };
      });

      if (parsedQuestions.length === 0) {
        setBulkLoading(false);
        return alert('No se encontraron preguntas con el formato correcto.');
      }

      await api.post(`/admin/questions/${chapterId}/bulk`, { questions: parsedQuestions, mode: bulkMode });
      
      setBulkText('');
      setShowBulk(false);
      fetchQuestions();
      alert(`¡Éxito! Se procesaron ${parsedQuestions.length} preguntas.`);
    } catch (err) {
      console.error(err);
      alert('Error importando preguntas. Revisa el formato.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleUpdate = async (id) => {
    try {
      await api.put(`/admin/questions/${id}`, form);
      setEditing(null);
      resetForm();
      fetchQuestions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta pregunta?')) return;
    try {
      await api.del(`/admin/questions/${id}`);
      fetchQuestions();
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (q) => {
    setEditing(q.id);
    setForm({
      question_text: q.question_text, option_a: q.option_a, option_b: q.option_b,
      option_c: q.option_c, option_d: q.option_d, correct_answer: q.correct_answer,
      difficulty: q.difficulty, explanation: q.explanation || '', verse_reference: q.verse_reference || ''
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="font-[Cinzel] text-2xl font-bold text-primary">
          Gestionar Preguntas ({questions.length})
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowBulk(!showBulk); setShowAdd(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <FileText className="w-4 h-4" /> Importación Masiva (.txt)
          </button>
          <button
            onClick={() => { setShowAdd(!showAdd); setShowBulk(false); resetForm(); }}
            className="flex items-center gap-2 px-4 py-2 bg-gold text-white rounded hover:bg-gold-dark text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Agregar Individual
          </button>
        </div>
      </div>

      {/* Bulk Import Form */}
      {showBulk && (
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200 mb-6 shadow-sm">
          <h2 className="font-bold text-blue-900 mb-2">Importar Preguntas Masivamente</h2>
          <p className="text-sm text-blue-800 mb-4">Pega el texto con las preguntas. Deben seguir estrictamente este formato (puedes pegar muchas a la vez):</p>
          <pre className="bg-white p-3 rounded border text-xs font-mono text-gray-700 mb-4 whitespace-pre-wrap">
PREGUNTA: ¿De dónde era Elcana?
A. Belén
B. Ramataim de Zofim
C. Jerusalén
D. Hebrón
RESPUESTA: b
EXPLICACION: Era de Ramataim de Zofim, del monte de Efraín.
VERSICULO: 1 Samuel 1:1
          </pre>
          
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder="Pega todas tus preguntas aquí..."
            className="w-full h-48 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none mb-4"
          />

          <div className="flex items-center gap-6 mb-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" value="append" checked={bulkMode === 'append'} onChange={() => setBulkMode('append')} className="text-blue-600" />
              Añadir a las existentes
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer text-danger font-medium">
              <input type="radio" value="replace" checked={bulkMode === 'replace'} onChange={() => setBulkMode('replace')} className="text-red-600" />
              Reemplazar TODAS las actuales
            </label>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={handleBulkSubmit} 
              disabled={bulkLoading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {bulkLoading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Procesar y Guardar
            </button>
            <button onClick={() => setShowBulk(false)} className="px-6 py-2 bg-white text-gray-700 border rounded hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <QuestionForm
          form={form}
          setForm={setForm}
          onSubmit={handleAdd}
          onCancel={() => setShowAdd(false)}
          submitLabel="Crear Pregunta"
        />
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-white rounded-lg shadow-sm border p-4">
            {editing === q.id ? (
              <QuestionForm
                form={form}
                setForm={setForm}
                onSubmit={() => handleUpdate(q.id)}
                onCancel={() => { setEditing(null); resetForm(); }}
                submitLabel="Guardar Cambios"
              />
            ) : (
              <>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-primary-dark mb-2">
                      <span className="text-gray-400 mr-2">#{i + 1}</span>
                      {q.question_text}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                      {['a', 'b', 'c', 'd'].map(letter => (
                        <div
                          key={letter}
                          className={`p-2 rounded ${letter === q.correct_answer ? 'bg-green-100 border border-green-300 font-bold text-green-900' : 'bg-gray-50'}`}
                        >
                          {letter.toUpperCase()}. {q[`option_${letter}`]}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500 mt-3">
                      <span className="bg-gray-100 px-2 py-1 rounded">Dificultad: {q.difficulty}</span>
                      <span className="bg-gray-100 px-2 py-1 rounded">Ref: {q.verse_reference || 'N/A'}</span>
                    </div>
                    {q.explanation && (
                      <p className="text-xs text-gray-500 mt-2 bg-blue-50 p-2 rounded">
                        <span className="font-bold">Expl:</span> {q.explanation}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => startEdit(q)} className="p-2 text-blue-500 hover:bg-blue-50 rounded transition-colors" title="Editar">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(q.id)} className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const QuestionForm = ({ form, setForm, onSubmit, onCancel, submitLabel }) => (
  <div className="bg-parchment rounded-xl p-6 border mb-6 space-y-4">
    <div>
      <label className="block text-sm font-medium mb-1">Pregunta</label>
      <textarea
        value={form.question_text}
        onChange={e => setForm(f => ({ ...f, question_text: e.target.value }))}
        className="w-full p-2 border rounded resize-none h-20 focus:ring-2 focus:ring-gold focus:outline-none"
      />
    </div>
    <div className="grid grid-cols-2 gap-4">
      {['a', 'b', 'c', 'd'].map(letter => (
        <div key={letter}>
          <label className="block text-sm font-medium mb-1">Opción {letter.toUpperCase()}</label>
          <input
            value={form[`option_${letter}`]}
            onChange={e => setForm(f => ({ ...f, [`option_${letter}`]: e.target.value }))}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-gold focus:outline-none"
          />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium mb-1">Respuesta Correcta</label>
        <select value={form.correct_answer} onChange={e => setForm(f => ({ ...f, correct_answer: e.target.value }))} className="w-full p-2 border rounded">
          {['a', 'b', 'c', 'd'].map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Dificultad</label>
        <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))} className="w-full p-2 border rounded">
          <option value="fácil">Fácil</option>
          <option value="medio">Medio</option>
          <option value="difícil">Difícil</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Referencia</label>
        <input value={form.verse_reference} onChange={e => setForm(f => ({ ...f, verse_reference: e.target.value }))} className="w-full p-2 border rounded" />
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium mb-1">Explicación</label>
      <textarea value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} className="w-full p-2 border rounded resize-none h-16" />
    </div>
    <div className="flex gap-2">
      <button onClick={onSubmit} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary-light text-sm">
        <Save className="w-4 h-4" /> {submitLabel}
      </button>
      <button onClick={onCancel} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
        <X className="w-4 h-4" /> Cancelar
      </button>
    </div>
  </div>
);

export default QuestionManager;
