import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Smartphone, CheckCircle, AlertCircle, Loader, Send, Info } from 'lucide-react';
import { 
  getPushStatus, 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications, 
  sendTestPush,
  isIOSDevice,
  isStandalonePWA
} from '../../utils/pushManager';

const PushNotificationManager = ({ compact = false }) => {
  const [status, setStatus] = useState({
    supported: false,
    permission: 'default',
    isSubscribed: false,
    isIOS: false,
    isStandalone: false
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await getPushStatus();
      setStatus(res);
      // Si es iOS y no está en modo standalone, avisarle
      if (res.isIOS && !res.isStandalone) {
        setShowIOSGuide(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      if (status.isIOS && !status.isStandalone) {
        setShowIOSGuide(true);
        setActionLoading(false);
        return;
      }
      await subscribeToPushNotifications();
      await checkStatus();
      setMessage({ type: 'success', text: '¡Notificaciones activadas con éxito en este dispositivo!' });
    } catch (err) {
      console.error(err);
      setMessage({ 
        type: 'error', 
        text: err.message || 'No se pudieron activar las notificaciones. Verifica los permisos de tu navegador.' 
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!confirm('¿Deseas dejar de recibir notificaciones push en este dispositivo?')) return;
    setActionLoading(true);
    setMessage(null);
    try {
      await unsubscribeFromPushNotifications();
      await checkStatus();
      setMessage({ type: 'info', text: 'Notificaciones desactivadas en este dispositivo.' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Error al desactivar notificaciones.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTest = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      await sendTestPush();
      setTestSent(true);
      setMessage({ type: 'success', text: '¡Notificación enviada! Deberías verla en tu pantalla ahora mismo.' });
      setTimeout(() => setTestSent(false), 5000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Error al enviar prueba.' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-gray-500 bg-gray-50 rounded-lg">
        <Loader className="w-4 h-4 animate-spin text-gold" />
        Comprobando compatibilidad de notificaciones...
      </div>
    );
  }

  // Si no está soportado en este navegador
  if (!status.supported) {
    return (
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-600 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-gray-700">Notificaciones no soportadas en este navegador</p>
          <p className="text-xs text-gray-500 mt-1">
            Tu navegador actual o modo incógnito no soporta el estándar Web Push. Para recibirlas, te recomendamos usar Google Chrome, Microsoft Edge, o Safari (añadiendo a inicio).
          </p>
        </div>
      </div>
    );
  }

  // Versión compacta (para banners en DuelsPage)
  if (compact) {
    if (status.isSubscribed) return null; // Si ya está suscrito, no molestar con el banner compacto

    return (
      <div className="bg-gradient-to-r from-primary to-primary-light text-white p-4 rounded-xl shadow-md border border-gold/30 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5 text-gold animate-bounce" />
          </div>
          <div>
            <h4 className="font-bold text-sm">¿Quieres saber al instante cuándo te reten?</h4>
            <p className="text-xs text-gray-200">Activa las notificaciones en tu celular o PC y no te pierdas ningún turno.</p>
          </div>
        </div>
        <button
          onClick={handleSubscribe}
          disabled={actionLoading}
          className="px-4 py-2 bg-gold hover:bg-gold-light text-primary font-bold text-xs rounded-lg transition-colors whitespace-nowrap shadow-sm disabled:opacity-50 flex items-center gap-2"
        >
          {actionLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          Activar Alertas
        </button>
      </div>
    );
  }

  // Versión completa (para ProfilePage)
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${status.isSubscribed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {status.isSubscribed ? <BellRing className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-cinzel text-lg font-bold text-primary flex items-center gap-2">
              Notificaciones Push
              {status.isSubscribed && (
                <span className="text-xs bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Activas en este dispositivo
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {status.isSubscribed 
                ? 'Recibirás avisos al instante cuando te reten a un duelo o jueguen su turno.' 
                : 'Recibe alertas en segundo plano en este dispositivo cuando sea y donde sea.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status.isSubscribed ? (
            <>
              <button
                onClick={handleTest}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 border disabled:opacity-50"
                title="Comprobar que llega a tu pantalla"
              >
                {actionLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-primary" />}
                Probar Alerta
              </button>
              <button
                onClick={handleUnsubscribe}
                disabled={actionLoading}
                className="px-3 py-2 text-danger hover:bg-red-50 text-xs font-bold rounded-lg transition-colors border border-red-200 disabled:opacity-50"
              >
                Desactivar
              </button>
            </>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={actionLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-light hover:brightness-110 text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {actionLoading ? <Loader className="w-4 h-4 animate-spin text-gold" /> : <Bell className="w-4 h-4 text-gold" />}
              Activar en este Dispositivo
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-xs font-medium mb-4 flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Guía interactiva para usuarios de iPhone / iPad */}
      {status.isIOS && !status.isStandalone && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 mt-3">
          <div className="flex items-center gap-2 font-bold mb-2 text-amber-950">
            <Smartphone className="w-4 h-4 text-amber-700" />
            Requisito especial para iPhone / iPad (iOS):
          </div>
          <p className="mb-2 text-amber-800">
            Apple exige que la aplicación esté añadida a tu pantalla de inicio para que las notificaciones lleguen con la pantalla apagada:
          </p>
          <ol className="list-decimal list-inside space-y-1 font-medium pl-1 text-amber-900">
            <li>Toca el botón <strong>Compartir</strong> en Safari (el icono de un cuadrado con una flecha hacia arriba).</li>
            <li>Baja en el menú y selecciona <strong>"Añadir a la pantalla de inicio"</strong>.</li>
            <li>Abre la aplicación desde tu pantalla de inicio y presiona <strong>"Activar en este Dispositivo"</strong>.</li>
          </ol>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600 mt-2">
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-start gap-2">
          <span className="text-base">⚔️</span>
          <div>
            <strong className="block text-gray-800">Retos de Duelo</strong>
            Te avisará de inmediato cuando alguien te desafíe con una apuesta.
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-start gap-2">
          <span className="text-base">⏱️</span>
          <div>
            <strong className="block text-gray-800">Turnos en Juego</strong>
            Sabrás al instante cuando tu oponente termine sus 5 preguntas.
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-start gap-2">
          <span className="text-base">🏆</span>
          <div>
            <strong className="block text-gray-800">Resultados y Puntos</strong>
            Te notificará si ganaste el duelo y cuántos puntos obtuviste.
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushNotificationManager;
