import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { BookOpen, Check, X, Loader, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import Modal from '../../components/shared/Modal';

const AdminEssays = () => {
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('respuestas'); // 'respuestas' | 'preguntas'

  // Modal para nueva pregunta
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newPoints, setNewPoints] = useState(500);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [qData, rData] = await Promise.all([
        api.get('/essays/admin/questions'),
        api.get('/essays/admin/responses')
      ]);
      setQuestions(qData);
      setResponses(rData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    try {
      await api.post('/essays/admin/questions', { question_text: newQuestionText, points_reward: newPoints });
      setNewQuestionText('');
      setNewPoints(500);
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error creando pregunta');
    }
  };

  const toggleQuestionStatus = async (id, currentStatus) => {
    try {
      await api.put(`/essays/admin/questions/${id}/toggle`, { is_active: !currentStatus });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error al cambiar estado');
    }
  };

  const deleteQuestion = async (id) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta pregunta para todos? Se borrarán también las respuestas asociadas.')) return;
    try {
      await api.del(`/essays/admin/questions/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar la pregunta');
    }
  };

  const evaluateResponse = async (id, status) => {
    if (!confirm(`¿Estás seguro de marcar esta respuesta como ${status === 'approved' ? 'APROBADA' : 'RECHAZADA'}?`)) return;
    try {
      await api.post(`/essays/admin/responses/${id}/evaluate`, { status });
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Error evaluando');
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Loader className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <BookOpen className="w-6 h-6" /> Preguntas Extendidas
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('respuestas')} 
            className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'respuestas' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Evaluar Respuestas
          </button>
          <button 
            onClick={() => setActiveTab('preguntas')} 
            className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'preguntas' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Gestionar Preguntas
          </button>
        </div>
      </div>

      {activeTab === 'preguntas' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-success text-white px-4 py-2 rounded font-bold hover:bg-green-600">
              <Plus className="w-4 h-4" /> Nueva Pregunta
            </button>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 text-left">Pregunta</th>
                  <th className="p-4 text-center">Recompensa</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {questions.map(q => (
                  <tr key={q.id}>
                    <td className="p-4">{q.question_text}</td>
                    <td className="p-4 text-center text-gold font-bold">{q.points_reward} pts</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${q.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {q.is_active ? 'ACTIVA' : 'INACTIVA'}
                      </span>
                    </td>
                    <td className="p-4 flex justify-center items-center gap-4">
                      <button onClick={() => toggleQuestionStatus(q.id, q.is_active)} className="text-gray-500 hover:text-primary">
                        {q.is_active ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                      </button>
                      <button onClick={() => deleteQuestion(q.id)} className="text-gray-400 hover:text-danger">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'respuestas' && (
        <div className="space-y-4">
          {responses.length === 0 ? (
            <p className="text-gray-500 p-6 text-center bg-white rounded-xl border">No hay respuestas de los estudiantes aún.</p>
          ) : (
            responses.map(r => (
              <div key={r.id} className={`bg-white rounded-xl p-5 border shadow-sm ${r.status === 'pending' ? 'border-l-4 border-l-warning' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-sm text-gray-500">Respondido por: <strong className="text-primary">{r.user?.username}</strong></span>
                    <h4 className="font-bold mt-1">{r.question?.question_text}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400 block">{new Date(r.created_at).toLocaleDateString()}</span>
                    <span className="text-gold font-bold text-sm">Premio: {r.question?.points_reward} pts</span>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-3 rounded text-gray-800 text-sm italic mb-4 whitespace-pre-wrap">
                  "{r.response_text}"
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    {r.status === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">Pendiende de Revisión</span>}
                    {r.status === 'approved' && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Aprobada</span>}
                    {r.status === 'rejected' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">Rechazada</span>}
                  </div>
                  
                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => evaluateResponse(r.id, 'rejected')} className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded font-bold text-sm transition-colors">
                        <X className="w-4 h-4" /> Rechazar (0 pts)
                      </button>
                      <button onClick={() => evaluateResponse(r.id, 'approved')} className="flex items-center gap-1 bg-success hover:bg-green-600 text-white px-3 py-1 rounded font-bold text-sm transition-colors">
                        <Check className="w-4 h-4" /> Aprobar (+{r.question?.points_reward} pts)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {isModalOpen && (
        <Modal isOpen={true} title="Nueva Pregunta Extendida" onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleCreateQuestion} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Pregunta / Tema a desarrollar</label>
              <textarea 
                required
                value={newQuestionText}
                onChange={e => setNewQuestionText(e.target.value)}
                className="w-full p-2 border rounded min-h-[100px] outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ej. Explica brevemente la importancia de la paciencia de David..."
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Puntos de Recompensa</label>
              <input 
                type="number" 
                required
                min="0"
                value={newPoints}
                onChange={e => setNewPoints(e.target.value)}
                className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-primary text-white font-bold rounded hover:bg-primary-light">Crear Pregunta</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminEssays;
