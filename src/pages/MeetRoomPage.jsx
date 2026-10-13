import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { io } from 'socket.io-client';
import { 
  Users, 
  BookOpen, 
  Radio, 
  ArrowLeft, 
  Sparkles, 
  Clock, 
  Award, 
  Trophy, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  ChevronLeft, 
  FileText, 
  ExternalLink,
  Flame,
  Volume2,
  VolumeX,
  Swords,
  Hand,
  Check
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import { playNotificationSound } from '../utils/notificationSound';

const REACTION_EMOJIS = [
  { id: 'amen', label: 'Amén 🙏', icon: '🙏' },
  { id: 'fuego', label: 'Fuego 🔥', icon: '🔥' },
  { id: 'gloria', label: 'Gloria a Dios 🕊️', icon: '🕊️' },
  { id: 'bendicion', label: 'Bendición ❤️', icon: '❤️' }
];

export function getUniversalPdfViewerUrl(url, page = 1) {
  if (!url) return '';
  const trimmed = url.trim();

  // Si es un enlace de Google Drive
  if (trimmed.includes('drive.google.com')) {
    const driveMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }
  }

  // Si ya es un visor incrustado o data URL
  if (trimmed.startsWith('data:') || trimmed.includes('docs.google.com/viewer')) {
    return trimmed;
  }

  // Si es un archivo PDF web directo
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Usar Google Docs Viewer para compatibilidad perfecta en iOS Safari y Android Chrome sin forzar descarga
    return `https://docs.google.com/viewer?url=${encodeURIComponent(trimmed)}&embedded=true`;
  }

  return `${trimmed}#page=${page}&toolbar=0&navpanes=0`;
}

const MeetRoomPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [meet, setMeet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  // Estados de la Sala
  const [phase, setPhase] = useState('reading'); // 'reading' | 'quiz' | 'finished'
  const [participants, setParticipants] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [syncWithHost, setSyncWithHost] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [currentReader, setCurrentReader] = useState(null);
  const [laserPointer, setLaserPointer] = useState({ x: 0, y: 0, active: false });
  const [laserModeActive, setLaserModeActive] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [showHandsModal, setShowHandsModal] = useState(false);

  // Estados de Preguntas (Quiz)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25);
  const [revealedResults, setRevealedResults] = useState(null);
  const [mySessionScore, setMySessionScore] = useState(0);
  const [finalPodium, setFinalPodium] = useState([]);

  const isHost = meet && (String(user?.id) === String(meet.host_id) || ['admin', 'superadmin', 'lider', 'leader'].includes(user?.role?.toLowerCase()));
  const pdfContainerRef = useRef(null);

  useEffect(() => {
    loadMeetDetails();
  }, [id]);

  const loadMeetDetails = async () => {
    try {
      const data = await api.get(`/meetings/${id}`);
      setMeet(data);
    } catch (err) {
      console.error('Error cargando meet:', err);
      alert('Error cargando la sala Meet.');
      navigate('/meet');
    } finally {
      setLoading(false);
    }
  };

  // Inicializar Socket.io
  useEffect(() => {
    if (!user || !meet) return;

    // Detectar endpoint socket correcto (usar host actual o puerto 3001 si estamos en vite 5173 local)
    const socketUrl = window.location.port === '5173' ? 'http://localhost:3001' : window.location.origin;
    const s = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    setSocket(s);

    const joinRoom = () => {
      s.emit('meet:join', { meetId: id, user });
    };

    s.on('connect', joinRoom);
    s.on('reconnect', joinRoom);
    if (s.io) {
      s.io.on('reconnect', joinRoom);
    }

    s.on('meet:initial-state', (state) => {
      setPhase(state.phase || 'reading');
      setCurrentPage(state.currentPage || 1);
      setCurrentReader(state.currentReader || null);
      setParticipants(state.participants || []);
      
      const me = (state.participants || []).find(p => String(p.id) === String(user.id));
      if (me) setMySessionScore(me.score || 0);

      if (state.phase === 'quiz' && state.questions && state.questions.length > 0) {
        const qIdx = state.currentQuestionIndex >= 0 ? state.currentQuestionIndex : 0;
        setCurrentQuestionIndex(qIdx);
        setCurrentQuestion(state.questions[qIdx]);
      }
    });

    s.on('meet:participants-updated', ({ participants: pts }) => {
      setParticipants(pts || []);
    });

    s.on('meet:page-synced', ({ page }) => {
      setCurrentPage(page);
    });

    s.on('meet:laser-synced', (laser) => {
      setLaserPointer(laser);
    });

    s.on('meet:hands-updated', ({ handsRaised, participants: pts }) => {
      setParticipants(pts || []);
      setIsHandRaised(handsRaised.includes(user.id));
    });

    s.on('meet:reader-assigned', ({ reader }) => {
      setCurrentReader(reader);
      if (reader && String(reader.id) === String(user.id)) {
        playNotificationSound();
        alert('📖 ¡El líder te ha asignado como lector de este pasaje!');
      }
    });

    s.on('meet:phase-changed', ({ phase: newPhase }) => {
      setPhase(newPhase);
      if (newPhase === 'quiz') {
        playNotificationSound();
      }
    });

    s.on('meet:question-started', ({ questionIndex, question }) => {
      setCurrentQuestionIndex(questionIndex);
      setCurrentQuestion(question);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setRevealedResults(null);
      setTimeLeft(question.time_limit_seconds || 25);
      setAnsweredCount(0);
      playNotificationSound();
    });

    s.on('meet:answer-received', ({ isCorrect, points }) => {
      setHasAnswered(true);
      if (points > 0) {
        setMySessionScore(prev => prev + points);
      }
    });

    s.on('meet:answer-count-updated', ({ answeredCount: count }) => {
      setAnsweredCount(count);
    });

    s.on('meet:question-results', (results) => {
      setRevealedResults(results);
    });

    s.on('meet:final-podium', ({ podium }) => {
      setFinalPodium(podium || []);
      setPhase('finished');
      playNotificationSound();
    });

    s.on('meet:session-ended', ({ message, podium }) => {
      if (podium && Array.isArray(podium) && podium.length > 0) {
        setFinalPodium(podium);
      }
      setPhase('finished');
      playNotificationSound();
      if (message) {
        alert(`ℹ️ ${message}`);
      }
    });

    s.on('meet:reaction-received', ({ reaction, id: reactionId }) => {
      const emojiObj = REACTION_EMOJIS.find(r => r.id === reaction) || { icon: '✨' };
      setFloatingReactions(prev => [
        ...prev, 
        { id: reactionId, icon: emojiObj.icon, x: Math.random() * 80 + 10 }
      ]);
      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(r => r.id !== reactionId));
      }, 3000);
    });

    return () => {
      s.disconnect();
    };
  }, [user, meet, id]);

  // Temporizador de preguntas en vivo
  useEffect(() => {
    if (phase !== 'quiz' || revealedResults) return;

    if (timeLeft <= 0) {
      if (isHost && socket) {
        socket.emit('meet:reveal-question-results', { 
          meetId: id, 
          questionIndex: currentQuestionIndex 
        });
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, timeLeft, revealedResults, isHost, socket, id, currentQuestionIndex]);

  // Controles de Página del Líder
  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
    if (socket) {
      socket.emit('meet:change-page', { meetId: id, page: newPage });
    }
  };

  // Movimiento del Puntero Láser (Soporte Universal: Mouse + Pantalla Táctil / Mobile)
  const handlePointerCoords = (clientX, clientY) => {
    if (!isHost || !laserModeActive || !pdfContainerRef.current) return;
    const rect = pdfContainerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    if (socket) {
      socket.emit('meet:laser-move', { meetId: id, x, y, active: true });
    }
  };

  const handleMouseMove = (e) => {
    handlePointerCoords(e.clientX, e.clientY);
  };

  const handleTouchMove = (e) => {
    if (!isHost || !laserModeActive) return;
    if (e.touches && e.touches.length > 0) {
      handlePointerCoords(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchStart = (e) => {
    if (!isHost || !laserModeActive) return;
    if (e.touches && e.touches.length > 0) {
      handlePointerCoords(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handlePointerLeave = () => {
    if (!isHost || !laserModeActive) return;
    if (socket) {
      socket.emit('meet:laser-move', { meetId: id, x: 0, y: 0, active: false });
    }
  };

  // Enviar Reacción
  const sendReaction = (reactionType) => {
    if (socket) {
      socket.emit('meet:send-reaction', { meetId: id, reaction: reactionType });
    }
  };

  // Responder Pregunta
  const handleAnswerSelect = (optKey) => {
    if (hasAnswered || revealedResults) return;
    setSelectedAnswer(optKey);
    setHasAnswered(true);

    const limitSec = currentQuestion?.time_limit_seconds || 25;
    const timeTakenMs = (limitSec - timeLeft) * 1000;

    if (socket) {
      socket.emit('meet:submit-answer', {
        meetId: id,
        questionIndex: currentQuestionIndex,
        selectedAnswer: optKey,
        timeTakenMs
      });
    }
  };

  // Líder avanza de pregunta
  const handleNextQuestion = () => {
    if (socket) {
      socket.emit('meet:next-question', { meetId: id });
    }
  };

  // Líder inicia Quiz
  const handleStartQuiz = () => {
    if (!confirm('¿Deseas iniciar la ronda de preguntas en vivo para todos los miembros?')) return;
    if (socket) {
      socket.emit('meet:start-quiz', { meetId: id });
    }
  };

  // Líder finaliza / cierra la reunión en vivo
  const handleEndMeeting = async () => {
    if (!confirm('¿Deseas finalizar y cerrar esta reunión en vivo para todos los miembros? Se registrarán las puntuaciones acumuladas y se mostrará el podio final.')) return;
    if (socket) {
      socket.emit('meet:end-session', { meetId: id });
    }
    try {
      await api.put(`/meetings/${id}/status`, { status: 'ended' });
    } catch (e) {
      console.error('Error cerrando meet:', e);
    }
  };

  if (loading || !meet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Radio className="w-10 h-10 text-gold animate-pulse" />
        <p className="text-gray-600 text-sm">Conectando a la sala en vivo de Remanente Meet...</p>
      </div>
    );
  }

  const handsRaisedList = Array.isArray(participants) ? participants.filter(p => p.handRaised) : [];

  return (
    <div className="flex flex-col h-[calc(100dvh-4.75rem)] sm:h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-6.75rem)] min-h-[440px] sm:min-h-[500px] max-w-7xl mx-auto bg-slate-900 rounded-xl sm:rounded-2xl shadow-2xl border border-gold/40 overflow-hidden relative">
      
      {/* 1. BARRA SUPERIOR DE CONTROL & ESTADO */}
      <div className="bg-primary-dark/95 border-b border-gold/30 px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 text-white shrink-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            to="/meet"
            className="text-gray-400 hover:text-white p-1 sm:p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
            title="Salir de la sala"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="flex h-2 w-2 sm:h-2.5 sm:w-2.5 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-red-500"></span>
              </span>
              <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-gold truncate">
                Meet {phase === 'reading' ? '• Lectura' : phase === 'quiz' ? '• Quiz' : '• Podio'}
              </span>
            </div>
            <h1 className="text-xs sm:text-base font-bold font-[Cinzel] text-white truncate max-w-[120px] xs:max-w-[180px] sm:max-w-xs md:max-w-md">
              {meet.title}
            </h1>
          </div>
        </div>

        {/* Centro: Lector Asignado o Puntuación */}
        <div className="hidden md:flex items-center gap-3 text-xs">
          {currentReader && (
            <div className="bg-gold/20 border border-gold/40 px-3 py-1 rounded-full text-gold-light font-medium flex items-center gap-1.5 animate-pulse">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Lector: <strong>{currentReader.name}</strong></span>
            </div>
          )}

          {phase === 'quiz' && (
            <div className="bg-amber-500/20 border border-amber-500/40 px-3 py-1 rounded-full text-amber-300 font-bold flex items-center gap-1.5">
              <Award className="w-4 h-4 text-gold" />
              <span>Mis Puntos: {mySessionScore}</span>
            </div>
          )}
        </div>

        {/* Derecha: Participantes y Controles */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={() => setShowHandsModal(true)}
            className={`relative p-1.5 sm:p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              handsRaisedList.length > 0 
                ? 'bg-amber-500 text-white animate-bounce' 
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
            title="Manos levantadas"
          >
            <Hand className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {handsRaisedList.length > 0 && (
              <span className="bg-red-600 text-white text-[10px] px-1 py-0.2 rounded-full font-bold">
                {handsRaisedList.length}
              </span>
            )}
          </button>

          <div className="bg-white/10 text-gray-200 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold" />
            <span className="text-[11px] sm:text-xs">{participants.length} <span className="hidden sm:inline">en vivo</span></span>
          </div>

          {/* Botón Maestro del Líder para pasar a Quiz */}
          {isHost && phase === 'reading' && (
            <button
              onClick={handleStartQuiz}
              className="inline-flex items-center gap-1 sm:gap-1.5 bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white px-2 sm:px-3.5 py-1.5 rounded-lg text-xs font-black shadow-lg transition-all animate-pulse"
            >
              <Swords className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Preguntas</span>
              <span>⚔️</span>
            </button>
          )}

          {/* Botón Maestro del Líder para Cerrar / Finalizar Reunión en Vivo */}
          {isHost && phase !== 'finished' && (
            <button
              onClick={handleEndMeeting}
              className="inline-flex items-center gap-1 sm:gap-1.5 bg-red-600/90 hover:bg-red-600 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer hover:scale-105"
              title="Finalizar y cerrar la sesión en vivo para todos los participantes"
            >
              <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              <span className="hidden sm:inline">Cerrar</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. CONTENIDO PRINCIPAL SEGÚN LA FASE */}
      <div className="flex-1 relative flex flex-col overflow-hidden bg-slate-950">
        
        {/* REACCIONES FLOTANTES (PARTÍCULAS) */}
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
          {floatingReactions.map(r => (
            <div
              key={r.id}
              style={{ left: `${r.x}%` }}
              className="absolute bottom-16 text-3xl animate-float-up pointer-events-none filter drop-shadow-lg"
            >
              {r.icon}
            </div>
          ))}
        </div>

        {/* ---------------- FASE A: LECTURA DE PDF ---------------- */}
        {phase === 'reading' && (
          <div className="flex-1 flex flex-col h-full relative">
            
            {/* Visor de Documento PDF */}
            <div 
              ref={pdfContainerRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handlePointerLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handlePointerLeave}
              onTouchCancel={handlePointerLeave}
              className={`flex-1 relative bg-slate-900 overflow-hidden flex items-center justify-center ${
                laserModeActive ? 'touch-none select-none cursor-crosshair' : ''
              }`}
            >
              {meet.pdfUrl ? (
                <>
                  <iframe
                    src={getUniversalPdfViewerUrl(meet.pdfUrl, currentPage)}
                    title="Documento PDF"
                    allow="fullscreen"
                    className="w-full h-full border-0 bg-white"
                  />

                  {/* Acceso directo a Pantalla Completa para dispositivos móviles y tablets */}
                  <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md border border-gold/30 p-1 rounded-xl shadow-lg">
                    <a
                      href={meet.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-gold hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-colors"
                      title="Abrir PDF en pantalla completa nativa o descargarlo"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Pantalla Completa</span>
                    </a>
                  </div>
                </>
              ) : (
                <div className="text-center p-6 sm:p-8 space-y-4 max-w-lg text-white">
                  <FileText className="w-14 h-14 sm:w-16 sm:h-16 text-gold/60 mx-auto" />
                  <h3 className="font-[Cinzel] text-lg sm:text-xl font-bold text-gold">
                    Estudio Bíblico: {meet.bookName || 'Palabra de Dios'}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-300">
                    El líder guiará la lectura en vivo de los capítulos seleccionados. Sigue las instrucciones del anfitrión y prepárate para la ronda interactiva de preguntas.
                  </p>
                </div>
              )}

              {/* PUNTERO LÁSER VIRTUAL EN VIVO */}
              {laserPointer.active && (
                <div
                  style={{ left: `${laserPointer.x}%`, top: `${laserPointer.y}%` }}
                  className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-red-500 shadow-[0_0_15px_5px_rgba(239,68,68,0.8)] pointer-events-none z-30 transition-all duration-75"
                >
                  <div className="w-full h-full rounded-full bg-white animate-ping opacity-60" />
                </div>
              )}
            </div>

            {/* BARRA INFERIOR DE ACCIONES Y REACCIONES */}
            <div className="bg-primary-dark/95 border-t border-gold/20 p-2 sm:p-2.5 px-2.5 sm:px-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-white shrink-0 z-20">
              
              {/* Lado Izquierdo: Paginación & Puntero (Líder) o Sincronización (Miembro) */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {isHost ? (
                  <>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="p-1 sm:p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
                      title="Página anterior"
                    >
                      <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <span className="text-[11px] sm:text-xs font-bold text-gray-200 whitespace-nowrap">
                      Pág. {currentPage}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      className="p-1 sm:p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                      title="Página siguiente"
                    >
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>

                    <button
                      onClick={() => setLaserModeActive(!laserModeActive)}
                      className={`ml-1 sm:ml-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                        laserModeActive 
                          ? 'bg-red-600 text-white shadow-md shadow-red-600/40 ring-2 ring-red-400' 
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-400 animate-pulse" />
                      <span>{laserModeActive ? 'Láser ON' : 'Láser'}</span>
                    </button>
                  </>
                ) : (
                  <div className="text-[11px] sm:text-xs text-gray-300 flex items-center gap-1.5 sm:gap-2">
                    <span className="font-bold text-gold">Pág. {currentPage}</span>
                    <span className="text-[10px] sm:text-[11px] text-gray-400 hidden xs:inline">• Guiado por líder</span>
                  </div>
                )}
              </div>

              {/* Centro / Derecha: Pedir la palabra & Reacciones */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {!isHost && (
                  <button
                    onClick={() => socket?.emit('meet:toggle-hand', { meetId: id })}
                    className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                      isHandRaised 
                        ? 'bg-amber-500 text-white shadow-md animate-pulse' 
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    <Hand className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{isHandRaised ? 'Mano ✋' : 'Hablar ✋'}</span>
                  </button>
                )}

                {/* Botones de Reacción Rápida */}
                <div className="flex items-center gap-0.5 sm:gap-1 bg-white/10 p-0.5 sm:p-1 rounded-xl">
                  {REACTION_EMOJIS.map(r => (
                    <button
                      key={r.id}
                      onClick={() => sendReaction(r.id)}
                      className="p-1 sm:p-1.5 hover:bg-white/20 rounded-lg text-sm sm:text-lg transition-transform hover:scale-125 active:scale-95"
                      title={r.label}
                    >
                      {r.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ---------------- FASE B: QUIZ EN VIVO ---------------- */}
        {phase === 'quiz' && currentQuestion && (
          <div className="flex-1 flex flex-col justify-between p-4 sm:p-8 max-w-4xl mx-auto w-full overflow-y-auto">
            
            {/* Barra de Progreso y Temporizador */}
            <div className="flex items-center justify-between gap-4 border-b border-gold/30 pb-4 text-white">
              <div>
                <span className="text-xs font-bold text-gold uppercase tracking-wider">
                  Pregunta {currentQuestionIndex + 1}
                </span>
                <p className="text-xs text-gray-400">
                  {answeredCount} de {participants.length} participantes han respondido
                </p>
              </div>

              {/* Temporizador */}
              {!revealedResults && (
                <div className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-base font-black ${
                  timeLeft <= 5 ? 'bg-red-600 text-white animate-pulse' : 'bg-gold/20 text-gold-light border border-gold/40'
                }`}>
                  <Clock className="w-4 h-4" />
                  <span>{timeLeft}s</span>
                </div>
              )}
            </div>

            {/* Tarjeta de la Pregunta */}
            <div className="my-6 space-y-6">
              <div className="bg-slate-900 border-2 border-gold/50 p-6 rounded-2xl shadow-xl text-center">
                <h2 className="font-[Cinzel] text-xl sm:text-2xl font-bold text-white leading-relaxed">
                  {currentQuestion.question_text}
                </h2>
              </div>

              {/* 4 Opciones Interactivas (A, B, C, D) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {['a', 'b', 'c', 'd'].map(optKey => {
                  const optText = currentQuestion[`option_${optKey}`];
                  if (!optText) return null;

                  const isSelected = selectedAnswer === optKey;
                  const isCorrect = revealedResults && revealedResults.correctAnswer === optKey;
                  const isWrongSelected = revealedResults && isSelected && !isCorrect;

                  let btnStyle = 'bg-slate-900 hover:bg-slate-800 border-gray-700 text-gray-200';
                  if (isSelected && !revealedResults) {
                    btnStyle = 'bg-gold/30 border-gold text-gold-light ring-2 ring-gold';
                  }
                  if (isCorrect) {
                    btnStyle = 'bg-green-600/30 border-green-500 text-green-200 ring-2 ring-green-500 font-bold';
                  } else if (isWrongSelected) {
                    btnStyle = 'bg-red-600/30 border-red-500 text-red-200 ring-2 ring-red-500';
                  }

                  const breakdownCount = revealedResults?.breakdown?.[optKey] || 0;

                  return (
                    <button
                      key={optKey}
                      disabled={hasAnswered || revealedResults}
                      onClick={() => handleAnswerSelect(optKey)}
                      className={`p-4 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer disabled:cursor-default ${btnStyle}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-sm uppercase shrink-0">
                          {optKey}
                        </span>
                        <span className="text-sm font-medium">{optText}</span>
                      </div>

                      {revealedResults && (
                        <span className="text-xs font-bold text-gray-300 bg-white/10 px-2 py-0.5 rounded-full">
                          {breakdownCount} votos
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Mensaje de espera para el participante */}
              {hasAnswered && !revealedResults && (
                <div className="p-3 bg-blue-900/40 border border-blue-500/40 rounded-xl text-center text-xs text-blue-200 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4 text-blue-400" />
                  <span>Respuesta registrada. Esperando a que termine el tiempo...</span>
                </div>
              )}

              {/* Explicación Bíblica Revelada */}
              {revealedResults && (
                <div className="bg-slate-900 border border-green-500/40 p-4 rounded-xl space-y-2 text-left animate-fadeIn">
                  <div className="flex items-center gap-2 text-green-400 font-bold text-xs uppercase tracking-wide">
                    <CheckCircle className="w-4 h-4" />
                    <span>Respuesta Correcta ({revealedResults.correctAnswer.toUpperCase()})</span>
                  </div>
                  <p className="text-xs text-gray-300">{revealedResults.explanation}</p>
                  {revealedResults.verseReference && (
                    <p className="text-[11px] text-gold italic">Cita Bíblica: {revealedResults.verseReference}</p>
                  )}
                </div>
              )}
            </div>

            {/* Barra de Control de la Pregunta */}
            <div className="border-t border-gold/20 pt-4 flex justify-between items-center text-white">
              <span className="text-xs text-gray-400 font-mono">
                Puntaje actual: {mySessionScore} pts
              </span>

              {isHost && (
                <div className="flex items-center gap-2">
                  {!revealedResults ? (
                    <button
                      onClick={() => socket?.emit('meet:reveal-question-results', { meetId: id, questionIndex: currentQuestionIndex })}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
                    >
                      Revelar Respuestas Ahora
                    </button>
                  ) : (
                    <button
                      onClick={handleNextQuestion}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white rounded-lg text-xs font-black shadow-lg transition-all animate-pulse"
                    >
                      <span>Siguiente Pregunta ➡️</span>
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ---------------- FASE C: PODIO FINAL & PREMIACIÓN ---------------- */}
        {phase === 'finished' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-white text-center max-w-2xl mx-auto space-y-6">
            <Trophy className="w-20 h-20 text-gold animate-bounce mx-auto" />
            
            <div>
              <h2 className="font-[Cinzel] text-3xl font-bold text-gold">
                ¡Gran Estudio y Quiz Finalizado!
              </h2>
              <p className="text-sm text-gray-300 mt-1">
                La gloria sea a Dios por su Palabra. Los Puntos de Sabiduría han sido acreditados a tu cuenta.
              </p>
            </div>

            {/* Podio de los 3 Mejores */}
            {finalPodium.length > 0 && (
              <div className="w-full bg-slate-900 border border-gold/40 rounded-2xl p-6 space-y-3">
                <h3 className="font-[Cinzel] text-base font-bold text-gold-light border-b border-gold/20 pb-2">
                  🏆 Tabla de Honor del Meet
                </h3>

                <div className="space-y-2">
                  {finalPodium.slice(0, 5).map((p, idx) => (
                    <div 
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded-xl border text-sm font-semibold ${
                        idx === 0 
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200' 
                          : idx === 1 
                          ? 'bg-slate-400/20 border-slate-300 text-slate-200' 
                          : idx === 2 
                          ? 'bg-amber-800/20 border-amber-700 text-amber-300' 
                          : 'bg-white/5 border-transparent text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-base">
                          {idx === 0 ? '🥇 1º' : idx === 1 ? '🥈 2º' : idx === 2 ? '🥉 3º' : `${idx + 1}º`}
                        </span>
                        <span>{p.username}</span>
                      </div>
                      <span className="font-mono font-bold text-gold">+{p.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => navigate('/meet')}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white px-6 py-3 rounded-xl font-bold text-sm shadow-xl transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a la Lista de Meets</span>
            </button>
          </div>
        )}

      </div>

      {/* MODAL DE MANOS LEVANTADAS (LÍDER Y PARTICIPANTES) */}
      {showHandsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 text-white border border-gold/40 rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-gold/20 pb-3">
              <h3 className="font-[Cinzel] text-base font-bold text-gold flex items-center gap-2">
                <Hand className="w-5 h-5 text-amber-400" />
                <span>Turnos de Lectura (Manos Levantadas)</span>
              </h3>
              <button onClick={() => setShowHandsModal(false)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {handsRaisedList.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Nadie tiene la mano levantada en este momento.</p>
              ) : (
                handsRaisedList.map((p, idx) => (
                  <div key={p.id} className="flex justify-between items-center p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs">
                    <span className="font-medium">{idx + 1}. {p.username}</span>
                    {isHost && (
                      <button
                        onClick={() => {
                          socket?.emit('meet:assign-reader', { meetId: id, readerId: p.id, readerName: p.username });
                          setShowHandsModal(false);
                        }}
                        className="bg-gold hover:bg-gold-dark text-slate-900 font-bold px-2.5 py-1 rounded text-[11px] transition-colors"
                      >
                        Asignar Lector
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowHandsModal(false)}
              className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold text-gray-300 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default MeetRoomPage;
