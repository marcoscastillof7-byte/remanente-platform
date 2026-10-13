// Motor de Audio y Notificaciones de Remanente Platform
// Produce sonido instantáneo y vibración notable en cualquier dispositivo (Web Audio + HTML5 Audio fallback)

let audioCtx = null;
let isAudioUnlocked = false;

/**
 * Inicializa o recupera el contexto de Web Audio
 */
function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

/**
 * Desbloquea las políticas de autoplay en navegadores móviles (iOS Safari, Android Chrome)
 * Se ejecuta al primer toque o click del usuario en cualquier parte de la pantalla.
 */
export function unlockAudio() {
  if (typeof window === 'undefined' || isAudioUnlocked) return;

  const unlock = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
      // Silencioso pre-calentamiento
      if (ctx) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(0);
        osc.stop(0.01);
      }
      isAudioUnlocked = true;
    } catch (e) {
      // Ignorar
    }

    document.removeEventListener('click', unlock, true);
    document.removeEventListener('touchstart', unlock, true);
    document.removeEventListener('keydown', unlock, true);
  };

  document.addEventListener('click', unlock, true);
  document.addEventListener('touchstart', unlock, true);
  document.addEventListener('keydown', unlock, true);
}

/**
 * Sintetiza un chime armónico de 3 tonos cristalinos (estilo campana regia)
 * 100% libre de descargas de red, cero latencia y compatible con todos los navegadores.
 */
function playSynthesizedChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // 3 tonos armónicos: D5 (587.3Hz), A5 (880Hz), D6 (1174.6Hz)
    const notes = [
      { freq: 587.33, start: now + 0.00, dur: 0.22, vol: 0.35 },
      { freq: 880.00, start: now + 0.12, dur: 0.28, vol: 0.40 },
      { freq: 1174.66, start: now + 0.24, dur: 0.50, vol: 0.45 }
    ];

    notes.forEach(note => {
      // Onda fundamental
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, note.start);

      // Envolvente de volumen (ataque rápido y decaimiento suave tipo campana)
      gain.gain.setValueAtTime(0.001, note.start);
      gain.gain.exponentialRampToValueAtTime(note.vol, note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, note.start + note.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(note.start);
      osc.stop(note.start + note.dur);

      // Armónico sutil para brillo y notoriedad
      const harmonic = ctx.createOscillator();
      const harmonicGain = ctx.createGain();
      harmonic.type = 'triangle';
      harmonic.frequency.setValueAtTime(note.freq * 2, note.start);

      harmonicGain.gain.setValueAtTime(0.001, note.start);
      harmonicGain.gain.exponentialRampToValueAtTime(note.vol * 0.25, note.start + 0.02);
      harmonicGain.gain.exponentialRampToValueAtTime(0.0001, note.start + note.dur * 0.7);

      harmonic.connect(harmonicGain);
      harmonicGain.connect(ctx.destination);

      harmonic.start(note.start);
      harmonic.stop(note.start + note.dur);
    });

    return true;
  } catch (err) {
    console.warn('[Audio] Error al reproducir chime sintetizado:', err);
    return false;
  }
}

/**
 * Reproduce el sonido de notificación en cualquier dispositivo.
 * Combina Web Audio sintetizado, archivo de audio .wav y vibración física de alta notoriedad.
 */
export function playNotificationSound() {
  if (typeof window === 'undefined') return;

  // 1. Vibración notable en móviles (patrón fuerte)
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([300, 100, 300, 100, 400]);
    } catch (_) {}
  }

  // 2. Chime cristalino por Web Audio API
  const synthSuccess = playSynthesizedChime();

  // 3. Fallback o refuerzo con elemento de Audio HTML5
  try {
    const audio = new Audio('/notification.wav');
    audio.volume = 0.9;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((e) => {
        // En caso de bloqueo por política de usuario, ya intentó el sintetizador
        if (!synthSuccess) {
          console.warn('[Audio] Reproducción bloqueada por navegador hasta interacción:', e.message);
        }
      });
    }
  } catch (_) {}
}

/**
 * Inicializar escucha de mensajes desde el Service Worker para reproducir sonido inmediato
 */
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PUSH_NOTIFICATION_RECEIVED') {
      console.log('[NotificationSound] Notificación Push recibida en primer plano:', event.data.payload);
      playNotificationSound();

      // Emitir evento global para que la interfaz reaccione y muestre el banner in-app
      window.dispatchEvent(
        new CustomEvent('remanente-push-received', {
          detail: event.data.payload
        })
      );
    }
  });

  // Activar desbloqueo automático en primera interacción
  unlockAudio();
}
