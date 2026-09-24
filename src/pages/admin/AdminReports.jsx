import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Flag, CheckCircle, XCircle, Loader } from 'lucide-react';
import { Link } from 'react-router';

const AdminReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const data = await api.get('/reports');
      // Solo mostramos los reportes pendientes en la interfaz
      setReports(data.filter(r => r.status === 'pendiente'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/reports/${id}`, { status });
      setReports(reports.filter(r => r.id !== id)); // Lo quitamos de la vista automáticamente
    } catch (err) {
      console.error(err);
    }
  };

  const deleteReport = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar y descartar este reporte?')) return;
    try {
      await api.del(`/reports/${id}`);
      setReports(reports.filter(r => r.id !== id)); // Lo quitamos de la vista automáticamente
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="font-[Cinzel] text-3xl font-bold text-primary mb-8 flex items-center gap-3">
        <Flag className="w-8 h-8 text-danger" /> Reportes de Usuarios
      </h1>

      {reports.length === 0 ? (
        <p className="text-gray-500 text-center py-16">No hay reportes de usuarios en este momento.</p>
      ) : (
        <div className="space-y-6">
          {reports.map(report => (
            <div key={report.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${report.status === 'pendiente' ? 'border-l-4 border-l-warning' : 'opacity-75'}`}>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                      report.status === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                      report.status === 'resuelto' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {report.status}
                    </span>
                    <h3 className="font-bold text-primary-dark mt-2">
                      {report.question_id ? `${report.book_name} - Capítulo ${report.chapter_number}` : 'Sugerencia General de Plataforma'}
                    </h3>
                    <p className="text-sm text-gray-500">Reportado por: {report.username} el {new Date(report.created_at).toLocaleDateString('es')}</p>
                  </div>
                  <div className="flex gap-2">
                    {report.status === 'pendiente' && (
                      <>
                        <button onClick={() => updateStatus(report.id, 'resuelto')} className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded transition-colors" title="Marcar como Resuelto">
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button onClick={() => deleteReport(report.id)} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded transition-colors" title="Descartar y Eliminar Reporte">
                          <XCircle className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {report.question_id && (
                  <div className="bg-gray-50 p-4 rounded-lg border mb-4">
                    <p className="font-medium text-gray-800">Pregunta Original:</p>
                    <p className="text-sm text-gray-600 italic">"{report.question_text}"</p>
                  </div>
                )}

                <div className="mb-4">
                  <p className="font-bold text-danger">{report.question_id ? `Problema: ${report.reason}` : `Asunto: ${report.reason}`}</p>
                  {report.details && <p className="text-gray-700 mt-1">Detalles: {report.details}</p>}
                </div>

                <div className="flex justify-end border-t pt-4">
                  {report.question_id ? (
                    <Link to={`/admin/questions/${report.chapter_id}`} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-light text-sm">
                      Ir al Gestor de Preguntas de este Capítulo
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-500 italic">Ticket general</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReports;
