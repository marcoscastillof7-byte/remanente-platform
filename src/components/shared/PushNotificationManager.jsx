import { useState, useEffect } from 'react';
import { 
  Bell, 
  BellOff, 
  BellRing, 
  Smartphone, 
  CheckCircle, 
  AlertCircle, 
  Loader, 
  Send, 
  Share, 
  PlusSquare, 
  ExternalLink,
  X,
  HelpCircle
} from 'lucide-react';
import { 
  getPushStatus, 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications, 
  sendTestPush 
} from '../../utils/pushManager';
import { playNotificationSound } from '../../utils/notificationSound';

const PushNotificationManager = ({ compact = false }) => {
  const [status, setStatus] = useState({
    supported: false,
    permission: 'default',
    isSubscribed: false,
    isIOS: false,
    isStandalone: false,
    needsIOSInstall: false,
    unsupportedReason: null
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await getPushStatus();
      setStatus(res);
    } catch (err) {
      console.error('Error comprobando estado de notificaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (status.needsIOSInstall) {
      setShowIOSModal(true);
      return;
    }

    setActionLoading(true);
    setMessage(null);
    try {
      await subscribeToPushNotifications();
      await checkStatus();
      setMessage({ 
        type: 'success', 
        text: '¡Notificaciones activadas con éxito en este dispositivo! Ya recibirás avisos de duelos.' 
      });
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
      playNotificationSound();
      await sendTestPush();
      setTestSent(true);
      setMessage({ 
        type: 'success', 
        text: '¡Notificación enviada con sonido! Revisa tu pantalla o centro de notificaciones.' 
      });
      setTimeout(() => setTestSent(false), 5000);
    } catch (err) {
      console.error(err);
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.error || err.message || 'Error al enviar notificación de prueba.' 
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-gray-500 bg-gray-50 rounded-lg">
        <Loader className="w-4 h-4 animate-spin text-gold" />
        Comprobando compatibilidad de notificaciones...
      </div>
    );
  }

  // Si requiere instalar como PWA en iOS y estamos en modo compacto (DuelsPage)
  if (status.needsIOSInstall && compact) {
    return (
      <>
        <div className="bg-gradient-to-r from-primary to-primary-light text-white p-4 rounded-xl shadow-md border border-gold/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h4 className="font-bold text-sm flex items-center gap-2">
                ¿Estás en iPhone / iPad?
                <span className="text-[10px] bg-gold/20 text-gold-light border border-gold/30 px-2 py-0.5 rounded-full font-normal">
                  iOS
                </span>
              </h4>
              <p className="text-xs text-gray-200">
                Añade Remanente a tu pantalla de inicio para recibir alertas de duelos con la pantalla apagada.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowIOSModal(true)}
            className="px-4 py-2 bg-gold hover:bg-gold-light text-primary font-bold text-xs rounded-lg transition-colors whitespace-nowrap shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Share className="w-3.5 h-3.5" />
            Ver cómo activar
          </button>
        </div>

        {/* Modal de instrucciones iOS */}
        {showIOSModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative">
              <button 
                onClick={() => setShowIOSModal(false)}
                className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary text-gold flex items-center justify-center shrink-0 shadow-sm">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-cinzel text-lg font-bold text-primary">Activar en iPhone / iPad</h3>
                  <p className="text-xs text-gray-500">Solo toma 2 pasos rápidos (Requisito de Apple iOS)</p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs text-gray-700 my-4">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-sm">
                    1
                  </div>
                  <div>
                    <strong className="block text-gray-900 font-semibold mb-0.5">
                      Toca el botón Compartir ⬆️
                    </strong>
                    En la barra inferior de Safari de tu iPhone, presiona el botón central de compartir (un cuadro con una flecha hacia arriba).
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-sm">
                    2
                  </div>
                  <div>
                    <strong className="block text-gray-900 font-semibold mb-0.5">
                      "Añadir a la pantalla de inicio" ➕
                    </strong>
                    Baja un poco en el menú que aparece y pulsa la opción <strong>Añadir a la pantalla de inicio</strong> (o Add to Home Screen).
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center shrink-0 text-sm">
                    3
                  </div>
                  <div>
                    <strong className="block text-amber-950 font-semibold mb-0.5">
                      Abre Remanente desde tu inicio 📖
                    </strong>
                    Abre el icono que se creó en tu pantalla de inicio y entra a Duelos o Perfil. ¡Allí podrás pulsar <strong>Activar Notificaciones</strong> directamente!
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t flex justify-end">
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="px-5 py-2.5 bg-primary text-gold font-bold text-xs rounded-xl hover:bg-primary-light transition-colors"
                >
                  Entendido, lo haré ahora
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Si no está soportado en este navegador y NO es iOS que necesite instalarse
  if (!status.supported) {
    return (
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-600 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-gray-700">Notificaciones no disponibles en este navegador</p>
          <p className="text-xs text-gray-500 mt-1">
            {status.unsupportedReason || 'Tu navegador actual o modo incógnito no soporta el estándar Web Push. Para recibirlas, te recomendamos usar Google Chrome, Microsoft Edge, o Safari (añadiendo a la pantalla de inicio con iOS 16.4+).'}
          </p>
        </div>
      </div>
    );
  }

  // Versión compacta para Android/Desktop (DuelsPage)
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
          className="px-4 py-2 bg-gold hover:bg-gold-light text-primary font-bold text-xs rounded-lg transition-colors whitespace-nowrap shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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
            <h3 className="font-cinzel text-lg font-bold text-primary flex items-center gap-2 flex-wrap">
              Notificaciones Push
              {status.isSubscribed ? (
                <span className="text-xs bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Activas en este dispositivo
                </span>
              ) : status.needsIOSInstall ? (
                <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Smartphone className="w-3 h-3" /> Requiere añadir a inicio (iPhone)
                </span>
              ) : null}
              {status.isIOS && status.isStandalone && (
                <span className="text-[10px] bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
                  🍏 Modo iPhone PWA
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {status.isSubscribed 
                ? 'Recibirás avisos al instante cuando te reten a un duelo o jueguen su turno.' 
                : status.needsIOSInstall 
                ? 'En iPhone debes añadir la app a tu pantalla de inicio para habilitar notificaciones push.'
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
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 border disabled:opacity-50 cursor-pointer"
                title="Comprobar que llega a tu pantalla"
              >
                {actionLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-primary" />}
                Probar Alerta
              </button>
              <button
                onClick={handleUnsubscribe}
                disabled={actionLoading}
                className="px-3 py-2 text-danger hover:bg-red-50 text-xs font-bold rounded-lg transition-colors border border-red-200 disabled:opacity-50 cursor-pointer"
              >
                Desactivar
              </button>
            </>
          ) : status.needsIOSInstall ? (
            <button
              onClick={() => setShowIOSModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-light hover:brightness-110 text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Share className="w-4 h-4 text-gold" />
              Ver cómo activar en iPhone
            </button>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={actionLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-light hover:brightness-110 text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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

      {/* Tarjeta explicativa con pasos visuales para usuarios de iPhone / iPad en Safari regular */}
      {status.needsIOSInstall && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200 rounded-xl p-5 text-xs text-amber-950 mt-2 mb-4 shadow-xs">
          <div className="flex items-center gap-2.5 font-bold mb-2 text-primary">
            <div className="w-6 h-6 rounded-md bg-gold/20 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-primary" />
            </div>
            <span>¿Por qué iPhone requiere este paso?</span>
          </div>
          <p className="mb-3 text-gray-700 leading-relaxed">
            Apple exige estrictamente en iOS que cualquier aplicación web se agregue a la <strong>pantalla de inicio</strong> para permitir notificaciones push cuando el teléfono está bloqueado o con la pantalla apagada. Sigue estos 2 sencillos pasos:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-xs">
              <div className="flex items-center gap-2 text-primary font-bold mb-1">
                <span className="w-5 h-5 rounded-full bg-primary text-gold text-xs flex items-center justify-center">1</span>
                <span>Toca Compartir ⬆️</span>
              </div>
              <p className="text-gray-600 text-[11px]">
                En la barra inferior de Safari en tu iPhone, pulsa el botón central de compartir (cuadrado con flecha hacia arriba).
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-xs">
              <div className="flex items-center gap-2 text-primary font-bold mb-1">
                <span className="w-5 h-5 rounded-full bg-primary text-gold text-xs flex items-center justify-center">2</span>
                <span>Añadir a inicio ➕</span>
              </div>
              <p className="text-gray-600 text-[11px]">
                Desliza hacia abajo en el menú de Safari y selecciona <strong>"Añadir a la pantalla de inicio"</strong>.
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-xs">
              <div className="flex items-center gap-2 text-primary font-bold mb-1">
                <span className="w-5 h-5 rounded-full bg-primary text-gold text-xs flex items-center justify-center">3</span>
                <span>Abre y Activa 🚀</span>
              </div>
              <p className="text-gray-600 text-[11px]">
                Abre el icono de <strong>📖 Remanente</strong> desde tu pantalla de inicio y pulsa <strong>"Activar en este Dispositivo"</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal si el usuario pulsa el botón de ver cómo activar en iPhone */}
      {showIOSModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative">
            <button 
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary text-gold flex items-center justify-center shrink-0 shadow-sm">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-cinzel text-lg font-bold text-primary">Activar en iPhone / iPad</h3>
                <p className="text-xs text-gray-500">Requisito del sistema de Apple (iOS 16.4+)</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-gray-700 my-4">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-sm">
                  1
                </div>
                <div>
                  <strong className="block text-gray-900 font-semibold mb-0.5">
                    Toca el botón Compartir ⬆️
                  </strong>
                  En la barra inferior de Safari de tu iPhone, presiona el botón central de compartir (un cuadro con una flecha hacia arriba).
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-sm">
                  2
                </div>
                <div>
                  <strong className="block text-gray-900 font-semibold mb-0.5">
                    "Añadir a la pantalla de inicio" ➕
                  </strong>
                  Baja un poco en el menú que aparece y pulsa la opción <strong>Añadir a la pantalla de inicio</strong> (o Add to Home Screen).
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center shrink-0 text-sm">
                  3
                </div>
                <div>
                  <strong className="block text-amber-950 font-semibold mb-0.5">
                    Abre Remanente desde tu inicio 📖
                  </strong>
                  Abre la app desde tu pantalla de inicio y pulsa <strong>"Activar en este Dispositivo"</strong>. ¡Apple te pedirá el permiso y quedará 100% activa!
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t flex justify-end">
              <button
                onClick={() => setShowIOSModal(false)}
                className="px-5 py-2.5 bg-primary text-gold font-bold text-xs rounded-xl hover:bg-primary-light transition-colors cursor-pointer"
              >
                Entendido, lo haré ahora
              </button>
            </div>
          </div>
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
