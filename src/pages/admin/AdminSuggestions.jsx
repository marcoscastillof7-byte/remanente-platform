import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { MessageSquare, CheckCircle, XCircle, Loader } from 'lucide-react';

const AdminSuggestions = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const data = await api.get('/reports');
      // Solo mostramos sugerencias generales (question_id === null)
      setReports(data.filter(r => r.status === 'pendiente' && r.question_id === null));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/reports/${id}`, { status });
      setReports(reports.filter(r => r.id !== id)); 
    } catch (err) {
      console.error(err);
    }
  };

  const deleteReport = async (id) => {
    if (!confirm('¿Seguro que deseas descartar esta sugerencia?')) return;
    try {
      await api.del(`/reports/${id}`);
      setReports(reports.filter(r => r.id !== id)); 
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="font-[Cinzel] text-3xl font-bold text-primary mb-8 flex items-center gap-3">
        <MessageSquare className="w-8 h-8 text-blue-500" /> Buzón de Sugerencias
      </h1>

      {reports.length === 0 ? (
        <p className="text-gray-500 text-center py-16">No hay sugerencias nuevas en este momento.</p>
      ) : (
        <div className="space-y-6">
          {reports.map(report => (
            <div key={report.id} className="bg-white rounded-xl shadow-sm border overflow-hidden border-l-4 border-l-blue-500">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
                      Sugerencia / Reporte General
                    </span>
                    <h3 className="font-bold text-primary-dark mt-2">
                      De: {report.username}
                    </h3>
                    <p className="text-sm text-gray-500">Enviado el {new Date(report.created_at).toLocaleDateString('es')} a las {new Date(report.created_at).toLocaleTimeString('es')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(report.id, 'resuelto')} className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded transition-colors" title="Marcar como Resuelto / Leído">
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button onClick={() => deleteReport(report.id)} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded transition-colors" title="Descartar y Eliminar">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="font-bold text-blue-700">Asunto: {report.reason}</p>
                  <p className="text-gray-800 mt-2 whitespace-pre-wrap bg-gray-50 p-4 rounded border">{report.details}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminSuggestions;
