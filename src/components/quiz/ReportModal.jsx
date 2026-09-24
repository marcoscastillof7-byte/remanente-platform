import { useState } from 'react';
import { api } from '../../utils/api';
import { Flag, X, Loader, CheckCircle } from 'lucide-react';

const ReportModal = ({ question, onClose }) => {
  const [reason, setReason] = useState('Error Ortográfico');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/reports/${question.id}`, { reason, details });
      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (err) {
      console.error(err);
      alert('Error enviando el reporte');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-800">¡Reporte Enviado!</h3>
            <p className="text-gray-600 mt-2">Gracias por ayudarnos a mejorar.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <Flag className="w-6 h-6 text-danger" />
              <h2 className="font-[Cinzel] text-xl font-bold text-primary">Reportar Pregunta</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Razón del Reporte</label>
                <select 
                  value={reason} 
                  onChange={e => setReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-gold focus:outline-none"
                >
                  <option>Error Ortográfico</option>
                  <option>Respuesta Incorrecta</option>
                  <option>Pregunta mal formulada</option>
                  <option>Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Detalles Adicionales</label>
                <textarea 
                  value={details} 
                  onChange={e => setDetails(e.target.value)}
                  rows="3"
                  className="w-full border border-gray-300 rounded-lg p-2.5 resize-none focus:ring-2 focus:ring-gold focus:outline-none"
                  placeholder="Por favor explica el error para poder corregirlo..."
                  required
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-danger text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50">
                  {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Enviar Reporte'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
