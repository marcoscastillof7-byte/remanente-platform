import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { MessageSquare, Send, Loader } from 'lucide-react';

const HistoricalDetails = ({ chapterId, user }) => {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDetail, setNewDetail] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetchDetails();
  }, [chapterId]);

  const fetchDetails = async () => {
    try {
      const data = await api.get(`/historical-details/${chapterId}`);
      setDetails(data || []);
    } catch (err) {
      console.error('Error cargando detalles históricos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (!newDetail.trim()) return;

    setPosting(true);
    try {
      const posted = await api.post(`/historical-details/${chapterId}`, { content: newDetail });
      setDetails([posted, ...details]);
      setNewDetail('');
    } catch (err) {
      console.error('Error publicando detalle:', err);
      alert('Hubo un error al publicar.');
    } finally {
      setPosting(false);
    }
  };

  if (loading) return <Loader className="w-6 h-6 animate-spin text-gold mx-auto my-4" />;

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h3 className="font-[Cinzel] text-lg font-bold text-primary">Detalles Históricos</h3>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Comparte con otros estudiantes algún detalle histórico, dato curioso o contexto cultural que encontraste interesante sobre este capítulo.
      </p>

      {/* Formulario */}
      <form onSubmit={handlePost} className="mb-8">
        <textarea
          value={newDetail}
          onChange={(e) => setNewDetail(e.target.value)}
          placeholder="Escribe tu aporte aquí..."
          className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gold text-sm"
          maxLength={500}
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-400">{newDetail.length}/500</span>
          <button
            type="submit"
            disabled={posting || !newDetail.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary-light disabled:opacity-50 text-sm transition-colors"
          >
            {posting ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Compartir Dato
          </button>
        </div>
      </form>

      {/* Feed */}
      <div className="space-y-4">
        {details.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm italic">
            Sé el primero en compartir un detalle histórico de este capítulo.
          </div>
        ) : (
          details.map((item) => (
            <div key={item.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm text-primary">
                  {item.users?.username || 'Estudiante'} 
                  {item.user_id === user?.id && <span className="ml-2 text-xs bg-gold/20 text-gold-dark px-2 py-0.5 rounded-full">Tú</span>}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(item.created_at).toLocaleDateString('es')}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoricalDetails;
