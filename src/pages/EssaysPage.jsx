import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { BookOpen, Send, Loader, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const EssaysPage = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responseTexts, setResponseTexts] = useState({});
  const [submitting, setSubmitting] = useState({});

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const data = await api.get('/essays/active');
      setQuestions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (id, text) => {
    setResponseTexts(prev => ({ ...prev, [id]: text }));
  };

  const handleSubmit = async (qId) => {
    const text = responseTexts[qId];
    if (!text || text.trim().length < 50) {
      alert('Tu respuesta es muy corta. ¡Escribe una reflexión más profunda!');
      return;
    }
    setSubmitting(prev => ({ ...prev, [qId]: true }));
    try {
      await api.post(`/essays/${qId}/submit`, { response_text: text });
      alert('¡Respuesta enviada a los administradores!');
      fetchQuestions();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Error enviando la respuesta');
    } finally {
      setSubmitting(prev => ({ ...prev, [qId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-primary rounded-xl p-8 text-white text-center shadow-lg">
        <BookOpen className="w-16 h-16 text-gold mx-auto mb-4" />
        <h1 className="font-[Cinzel] text-3xl font-bold mb-2">Reflexiones y Retos</h1>
        <p className="text-gray-200">
          Responde a las preguntas de análisis planteadas por los líderes. ¡Escribe de forma detallada y gana puntos extra (500+ pts)!
        </p>
      </div>

      <div className="space-y-6">
        {questions.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border text-center text-gray-500 shadow-sm">
            No hay preguntas de reflexión activas en este momento.
          </div>
        ) : (
          questions.map(q => {
            const hasResponded = !!q.user_response;
            const status = hasResponded ? q.user_response.status : null;

            return (
              <div key={q.id} className="bg-white rounded-xl p-6 border shadow-sm flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg text-primary">{q.question_text}</h3>
                  <div className="bg-gold text-white px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                    +{q.points_reward} pts
                  </div>
                </div>

                {!hasResponded ? (
                  <div className="space-y-3">
                    <textarea 
                      className="w-full p-3 border rounded-lg resize-none min-h-[120px] focus:ring-2 focus:ring-gold outline-none"
                      placeholder="Escribe tu respuesta completa aquí..."
                      value={responseTexts[q.id] || ''}
                      onChange={(e) => handleTextChange(q.id, e.target.value)}
                    />
                    <div className="flex justify-end">
                      <button 
                        disabled={submitting[q.id]}
                        onClick={() => handleSubmit(q.id)}
                        className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-primary-light transition-colors disabled:opacity-50"
                      >
                        {submitting[q.id] ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar Respuesta
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg border space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      {status === 'pending' && <span className="flex items-center gap-1 text-warning font-bold text-sm"><Clock className="w-4 h-4"/> En evaluación por un Admin</span>}
                      {status === 'approved' && <span className="flex items-center gap-1 text-success font-bold text-sm"><CheckCircle className="w-4 h-4"/> ¡Aprobado! (Puntos asignados)</span>}
                      {status === 'rejected' && <span className="flex items-center gap-1 text-danger font-bold text-sm"><XCircle className="w-4 h-4"/> No aprobado en esta ocasión</span>}
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap italic">
                      "{q.user_response.response_text}"
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default EssaysPage;
