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
  Check,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import { playNotificationSound } from '../utils/notificationSound';

const REACTION_EMOJIS = [
  { id: 'amen', label: 'Amén 🙏', icon: '🙏' },
  { id: 'fuego', label: 'Fuego 🔥', icon: '🔥' },
  { id: 'gloria', label: 'Gloria a Dios 🕊️', icon: '🕊️' },
  { id: 'bendicion', label: 'Bendición ❤️', icon: '❤️' },
  { id: 'sabiduria', label: 'Sabiduría 💡', icon: '💡' },
  { id: 'aplausos', label: 'Aplausos 👏', icon: '👏' },
  { id: 'victoria', label: 'Victoria 🎉', icon: '🎉' }
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
  const [sessionClosing, setSessionClosing] = useState(null); // { message, countdown: 4 }
  const [answerStatus, setAnswerStatus] = useState({
    answeredCount: 0,
    totalParticipants: 0,
    answeredParticipants: [],
    pendingParticipants: [],
    allAnswered: false
  });
  const [liveLeaderboard, setLiveLeaderboard] = useState([]);
  const [activeResultsTab, setActiveResultsTab] = useState('resumen'); // 'resumen' | 'posiciones'

  const isHost = meet && (String(user?.id) === String(meet.host_id) || ['admin', 'superadmin', 'lider', 'leader'].includes(user?.role?.toLowerCase()));
  const pdfContainerRef = useRef(null);

  useEffect(() => {
    loadMeetDetails();
  }, [id]);

  const loadMeetDetails = async () => {
    try {
      const data = await api.get(`/meetings/${id}`);
      if (data?.status === 'ended') {
        setSessionClosing({
          message: 'Esta reunión ya ha sido finalizada por el líder.',
          countdown: 3
        });
        setMeet(data);
        return;
      }
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

      if (state.leaderboard && Array.isArray(state.leaderboard)) {
        setLiveLeaderboard(state.leaderboard);
      }

      if (state.revealedResults) {
        setRevealedResults(state.revealedResults);
      }

      if (state.answerStatus) {
        setAnswerStatus(state.answerStatus);
        setAnsweredCount(state.answerStatus.answeredCount || 0);
      }

      if (state.timeLeft !== undefined) {
        setTimeLeft(state.timeLeft);
      }

      if (state.hasAnswered !== undefined) {
        setHasAnswered(state.hasAnswered);
      }

      if (state.selectedAnswer) {
        setSelectedAnswer(state.selectedAnswer);
      }

      if (state.phase === 'quiz' && state.questions && state.questions.length > 0) {
        const qIdx = state.currentQuestionIndex >= 0 ? state.currentQuestionIndex : 0;
        setCurrentQuestionIndex(qIdx);
        setCurrentQuestion(state.questions[qIdx]);
      }
    });

    s.on('meet:participants-updated', ({ participants: pts }) => {
      setParticipants(pts || []);
      setAnswerStatus(prev => ({
        ...prev,
        totalParticipants: (pts || []).length
      }));
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

    s.on('meet:question-started', ({ questionIndex, totalQuestions, question, leaderboard }) => {
      setCurrentQuestionIndex(questionIndex);
      setCurrentQuestion(question);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setRevealedResults(null);
      setTimeLeft(question.time_limit_seconds || 25);
      setAnsweredCount(0);
      setAnswerStatus({
        answeredCount: 0,
        totalParticipants: participants.length,
        answeredParticipants: [],
        pendingParticipants: participants,
        allAnswered: false
      });
      if (leaderboard && Array.isArray(leaderboard)) {
        setLiveLeaderboard(leaderboard);
      }
      playNotificationSound();
    });

    s.on('meet:answer-received', ({ isCorrect, points }) => {
      setHasAnswered(true);
      if (points > 0) {
        setMySessionScore(prev => prev + points);
      }
      playNotificationSound();
    });

    s.on('meet:answer-status-updated', (status) => {
      setAnswerStatus(status);
      setAnsweredCount(status.answeredCount || 0);
      if (status.leaderboard && Array.isArray(status.leaderboard)) {
        setLiveLeaderboard(status.leaderboard);
      }
    });

    s.on('meet:answer-count-updated', ({ answeredCount: count }) => {
      setAnsweredCount(count);
    });

    s.on('meet:question-results', (results) => {
      setRevealedResults(results);
      if (results.leaderboard && Array.isArray(results.leaderboard)) {
        setLiveLeaderboard(results.leaderboard);
      }
      playNotificationSound();
    });

    s.on('meet:error', ({ message }) => {
      if (message) alert(message);
    });

    s.on('meet:final-podium', ({ podium }) => {
      setFinalPodium(podium || []);
      setPhase('finished');
      playNotificationSound();
    });

    s.on('meet:session-ended', ({ message, podium, meetId: endedMeetId }) => {
      if (endedMeetId && endedMeetId !== 'all' && String(endedMeetId) !== String(id)) {
        return;
      }
      if (podium && Array.isArray(podium) && podium.length > 0) {
        setFinalPodium(podium);
      }
      setPhase('finished');
      playNotificationSound();
      setSessionClosing({
        message: message || 'La reunión ha sido finalizada por el líder o administrador.',
        countdown: 4
      });
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

  // Manejo del conteo regresivo y cierre automático de la sala
  useEffect(() => {
    if (!sessionClosing) return;

    if (sessionClosing.countdown <= 0) {
      if (socket) {
        socket.disconnect();
      }
      navigate('/meet', { replace: true });
      return;
    }

    const timer = setTimeout(() => {
      setSessionClosing(prev => {
        if (!prev) return null;
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [sessionClosing, navigate, socket]);

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

  // Enviar Reacción Inmediata (Local + Remoto)
  const sendReaction = (reactionType) => {
    const emojiObj = REACTION_EMOJIS.find(r => r.id === reactionType) || { icon: '✨' };
    const localId = `${Date.now()}_${Math.random()}`;
    setFloatingReactions(prev => [
      ...prev, 
      { id: localId, icon: emojiObj.icon, x: Math.random() * 80 + 10 }
    ]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== localId));
    }, 2800);

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
    const timeTakenMs = Math.max(500, (limitSec - timeLeft) * 1000);

    if (socket) {
      socket.emit('meet:submit-answer', {
        meetId: id,
        questionIndex: currentQuestionIndex,
        selectedAnswer: optKey,
        timeTakenMs
      });
    }
  };

  // Líder revela / muestra resultados
  const handleRevealResults = () => {
    if (socket) {
      socket.emit('meet:reveal-question-results', {
        meetId: id,
        questionIndex: currentQuestionIndex
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
    if (!confirm('¿Deseas finalizar y cerrar esta reunión en vivo para todos los miembros? Se registrarán las puntuaciones acumuladas y se cerrará la sala automáticamente.')) return;
    if (socket) {
      socket.emit('meet:end-session', { meetId: id });
    }
    try {
      await api.put(`/meetings/${id}/status`, { status: 'ended' });
    } catch (e) {
      console.error('Error cerrando meet:', e);
    }
    setSessionClosing({
      message: 'Has finalizado la reunión. La sala se está cerrando para todos los participantes.',
      countdown: 3
    });
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
          {isHost && !sessionClosing && (
            <button
              onClick={handleEndMeeting}
              className="inline-flex items-center gap-1 sm:gap-1.5 bg-red-600/90 hover:bg-red-600 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer hover:scale-105"
              title="Finalizar y cerrar la sesión en vivo para todos los participantes"
            >
              <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              <span className="hidden sm:inline">Cerrar Meet</span>
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
          <div className="flex-1 flex flex-col justify-between p-3.5 sm:p-6 md:p-8 pb-20 sm:pb-8 max-w-4xl mx-auto w-full overflow-y-auto space-y-4">
            
            {/* 1. Barra de Progreso, Temporizador y Puntos */}
            <div className="bg-slate-900/80 border border-gold/30 p-3 sm:p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] sm:text-xs font-black text-gold uppercase tracking-wider bg-gold/15 px-2.5 py-0.5 rounded-full border border-gold/30">
                    Pregunta {currentQuestionIndex + 1} {revealedResults?.totalQuestions ? `de ${revealedResults.totalQuestions}` : (meet?.questionsCount ? `de ${meet.questionsCount}` : '')}
                  </span>
                  <span className="text-[11px] sm:text-xs text-gray-300 font-semibold hidden xs:inline">
                    • {answeredCount} de {participants.length} respondieron
                  </span>
                </div>
                <div className="w-32 sm:w-48 bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div 
                    className="bg-gold h-full transition-all duration-300"
                    style={{ width: `${participants.length > 0 ? (answeredCount / participants.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Mis Puntos */}
                <div className="bg-white/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-white/15 text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-gold" />
                  <span>Mis Puntos: <strong className="text-white font-mono">{mySessionScore}</strong></span>
                </div>

                {/* Temporizador */}
                {!revealedResults && (
                  <div className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl font-mono text-sm sm:text-base font-black ${
                    timeLeft <= 5 
                      ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400' 
                      : 'bg-gold/20 text-gold-light border border-gold/40'
                  }`}>
                    <Clock className="w-4 h-4" />
                    <span>{timeLeft}s</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Tarjeta Principal de la Pregunta */}
            <div className="bg-slate-900 border-2 border-gold/50 p-4 sm:p-6 rounded-2xl shadow-xl text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full blur-2xl pointer-events-none" />
              <h2 className="font-[Cinzel] text-lg sm:text-2xl font-bold text-white leading-relaxed">
                {currentQuestion.question_text}
              </h2>
            </div>

            {/* Barra Visual del Cronómetro en Vivo */}
            {!revealedResults && (
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/10 shadow-inner">
                <div 
                  className={`h-full transition-all duration-1000 ease-linear ${
                    timeLeft <= 5 ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-gold to-amber-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (timeLeft / (currentQuestion.time_limit_seconds || 25)) * 100))}%` }}
                />
              </div>
            )}

            {/* 3. Las 4 Opciones Interactivas (A, B, C, D) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
              {['a', 'b', 'c', 'd'].map(optKey => {
                const optText = currentQuestion[`option_${optKey}`];
                if (!optText) return null;

                const isSelected = selectedAnswer === optKey;
                const isCorrect = revealedResults && String(revealedResults.correctAnswer || '').toLowerCase() === optKey;
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
                    disabled={hasAnswered || !!revealedResults}
                    onClick={() => handleAnswerSelect(optKey)}
                    className={`p-3 sm:p-4 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer disabled:cursor-default ${btnStyle}`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs sm:text-sm uppercase shrink-0 ${
                        isCorrect ? 'bg-green-500 text-slate-900' : isWrongSelected ? 'bg-red-500 text-white' : isSelected ? 'bg-gold text-slate-900' : 'bg-white/10 text-white'
                      }`}>
                        {optKey}
                      </span>
                      <span className="text-xs sm:text-sm font-medium">{optText}</span>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isCorrect && (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      )}
                      {isWrongSelected && (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                      {revealedResults && (
                        <span className="text-[11px] sm:text-xs font-bold text-gray-300 bg-white/10 px-2 py-0.5 rounded-full">
                          {breakdownCount} {breakdownCount === 1 ? 'voto' : 'votos'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Aviso de espera para el participante */}
            {hasAnswered && !revealedResults && (
              <div className="p-3 bg-blue-900/40 border border-blue-500/40 rounded-xl text-center text-xs sm:text-sm text-blue-200 flex items-center justify-center gap-2">
                <Check className="w-4 h-4 text-blue-400" />
                <span>Tu respuesta fue enviada. Esperando a que el líder muestre los resultados...</span>
              </div>
            )}

            {/* 4. ESTADO EN VIVO MIENTRAS TODOS CONTESTAN (Antes de Mostrar Resultados) */}
            {!revealedResults && (() => {
              const answeredList = answerStatus.answeredParticipants || [];
              const correctList = answeredList.filter(p => p.isCorrect);
              const incorrectList = answeredList.filter(p => !p.isCorrect);
              const pendingList = (answerStatus.pendingParticipants && answerStatus.pendingParticipants.length > 0)
                ? answerStatus.pendingParticipants
                : participants.filter(p => !answeredList.some(ap => String(ap.id) === String(p.id)));
              const pendingCount = pendingList.length;
              const allCompleted = pendingCount === 0 && participants.length > 0;

              return (
                <div className="bg-slate-900/95 border border-gold/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
                  {/* Encabezado de Progreso en Vivo */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center text-gold border border-gold/40">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-white font-[Cinzel] tracking-wide">
                          Progreso en Vivo de la Pregunta
                        </h3>
                        <p className="text-[11px] text-gray-400">
                          {answeredList.length} de {participants.length} participantes han respondido
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {allCompleted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-400 text-emerald-300 animate-pulse">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>¡Todos Contestaron!</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-400 text-amber-300">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          <span>Faltan {pendingCount}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Panel de Supervisión para Líder / Admins */}
                  {isHost && (
                    <div className={`p-3 rounded-xl border text-xs transition-all ${
                      allCompleted
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 shadow-md shadow-emerald-950/50'
                        : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-start sm:items-center gap-2 min-w-0">
                          {allCompleted ? (
                            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                          ) : (
                            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                          )}
                          <div className="min-w-0">
                            {allCompleted ? (
                              <p className="font-semibold">
                                <strong className="text-emerald-300">¡Ronda Completa!</strong> Todos los participantes han contestado. Pulsa <strong>"Mostrar Resultados"</strong> para revelar la respuesta bíblica y las puntuaciones.
                              </p>
                            ) : (
                              <p className="font-medium">
                                <strong className="text-amber-300">Faltan por contestar ({pendingCount}):</strong>{' '}
                                <span className="text-gray-300">{pendingList.map(p => p.username).join(', ') || 'Nadie pendiente'}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {allCompleted && (
                          <button
                            onClick={handleRevealResults}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-slate-900 font-black rounded-xl text-xs shadow-lg transition-all cursor-pointer hover:scale-105 shrink-0 flex items-center justify-center gap-1.5"
                          >
                            <span>Mostrar Resultados Ahora</span>
                            <span>📊</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Las 3 Categorías en Tiempo Real: Correctos, Incorrectos y Faltan */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* 1. Correctos en Vivo */}
                    <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-400 border-b border-emerald-500/20 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Acertaron ({correctList.length})</span>
                        </span>
                        <span className="text-[10px] text-emerald-500 font-mono">✅ Bien</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {correctList.length === 0 ? (
                          <p className="text-[11px] text-gray-500 italic py-1">Esperando respuestas...</p>
                        ) : (
                          correctList.map(p => (
                            <div key={p.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-900/40 border border-emerald-500/40 text-xs font-semibold text-emerald-200">
                              <span>✅ {p.username}</span>
                              <span className="text-[10px] text-emerald-400 font-mono font-bold">+{p.points} pts</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* 2. Incorrectos en Vivo */}
                    <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-red-400 border-b border-red-500/20 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                          <span>Fallaron ({incorrectList.length})</span>
                        </span>
                        <span className="text-[10px] text-red-400 font-mono">❌ Mal</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {incorrectList.length === 0 ? (
                          <p className="text-[11px] text-gray-500 italic py-1">Sin fallos aún...</p>
                        ) : (
                          incorrectList.map(p => (
                            <div key={p.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-900/40 border border-red-500/40 text-xs font-semibold text-red-200">
                              <span>❌ {p.username}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* 3. Faltan por Responder (Pensando...) */}
                    <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-300 border-b border-amber-500/20 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Faltan ({pendingCount})</span>
                        </span>
                        <span className="text-[10px] text-amber-400 font-mono">⏳ Pendientes</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {pendingCount === 0 ? (
                          <p className="text-[11px] text-emerald-400 font-bold py-1">¡Nadie falta!</p>
                        ) : (
                          pendingList.map(p => (
                            <div key={p.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-900/30 border border-amber-500/40 text-xs font-semibold text-amber-200 animate-pulse">
                              <span>⏳ {p.username}</span>
                              <span className="text-[10px] text-amber-400/80">(Pensando...)</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tabla de Posicionamiento en Vivo */}
                  {liveLeaderboard.length > 0 && (
                    <div className="pt-3 border-t border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gold-light flex items-center gap-1.5">
                          <Trophy className="w-4 h-4 text-gold" />
                          <span>Tabla de Posicionamiento en Vivo ({liveLeaderboard.length} participantes):</span>
                        </p>
                        <span className="text-[11px] text-gray-400">Actualizada con cada respuesta</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-36 overflow-y-auto">
                        {liveLeaderboard.map((lp, idx) => {
                          const isMe = String(lp.id) === String(user?.id);
                          return (
                            <div 
                              key={lp.id} 
                              className={`flex items-center justify-between p-2 rounded-lg border text-xs font-semibold transition-all ${
                                isMe 
                                  ? 'bg-gold/20 border-gold text-gold-light ring-1 ring-gold' 
                                  : idx === 0 
                                  ? 'bg-amber-500/15 border-amber-400/60 text-amber-200' 
                                  : idx === 1 
                                  ? 'bg-slate-400/15 border-slate-300/60 text-slate-200' 
                                  : idx === 2 
                                  ? 'bg-amber-800/15 border-amber-700/60 text-amber-300' 
                                  : 'bg-white/5 border-white/10 text-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="font-bold text-[11px] shrink-0">
                                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}
                                </span>
                                <span className="truncate">{lp.username}</span>
                              </div>
                              <span className="font-mono font-bold text-gold shrink-0 ml-1">
                                {lp.score || 0} pts
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 5. RESULTADOS REVELADOS DETALLADOS (Después de Mostrar Resultados) */}
            {revealedResults && (
              <div className="space-y-4 animate-fadeIn">
                {/* Explicación Bíblica */}
                <div className="bg-slate-900 border-2 border-green-500/50 p-4 rounded-xl space-y-2 text-left">
                  <div className="flex items-center gap-2 text-green-400 font-bold text-xs sm:text-sm uppercase tracking-wide">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Respuesta Correcta: Opción {revealedResults.correctAnswer?.toUpperCase()}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-200 leading-relaxed">
                    {revealedResults.explanation}
                  </p>
                  {revealedResults.verseReference && (
                    <p className="text-xs text-gold font-semibold italic">
                      📖 Cita Bíblica: {revealedResults.verseReference}
                    </p>
                  )}
                </div>

                {/* Pestañas de Resultados: Quiénes acertaron/fallaron vs Tabla de Honor */}
                <div className="bg-slate-900 border border-gold/40 rounded-xl overflow-hidden">
                  <div className="flex border-b border-gold/20 bg-slate-950/60">
                    <button
                      onClick={() => setActiveResultsTab('resumen')}
                      className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
                        activeResultsTab === 'resumen' 
                          ? 'bg-gold/20 text-gold-light border-b-2 border-gold' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>Respuestas de Participantes</span>
                    </button>
                    <button
                      onClick={() => setActiveResultsTab('posiciones')}
                      className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
                        activeResultsTab === 'posiciones' 
                          ? 'bg-gold/20 text-gold-light border-b-2 border-gold' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Trophy className="w-4 h-4 text-gold" />
                      <span>Tabla de Posiciones ({revealedResults.leaderboard?.length || 0})</span>
                    </button>
                  </div>

                  <div className="p-3.5 sm:p-4">
                    {activeResultsTab === 'resumen' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {/* Acertaron */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-green-400 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Respondieron Correctamente ({revealedResults.correctParticipants?.length || 0})</span>
                          </h4>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {(revealedResults.correctParticipants || []).length === 0 ? (
                              <p className="text-xs text-gray-500 italic p-2 bg-white/5 rounded">Nadie acertó esta pregunta.</p>
                            ) : (
                              revealedResults.correctParticipants.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-green-950/40 border border-green-500/30 text-xs text-green-200">
                                  <span className="font-semibold">{p.username}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-green-300 font-bold">+{p.pointsGained} pts</span>
                                    {p.timeTakenMs > 0 && (
                                      <span className="text-[10px] text-gray-400">{(p.timeTakenMs / 1000).toFixed(1)}s</span>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Fallaron / Sin responder */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Respondieron Incorrectamente ({revealedResults.incorrectParticipants?.length || 0})</span>
                          </h4>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {(revealedResults.incorrectParticipants || []).length === 0 ? (
                              <p className="text-xs text-gray-500 italic p-2 bg-white/5 rounded">¡Nadie falló esta pregunta!</p>
                            ) : (
                              revealedResults.incorrectParticipants.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-200">
                                  <span className="font-semibold">{p.username}</span>
                                  <span className="text-[11px] text-red-300">
                                    Eligió: <strong>{p.selectedAnswer?.toUpperCase()}</strong>
                                  </span>
                                </div>
                              ))
                            )}
                          </div>

                          {(revealedResults.unrespondedParticipants || []).length > 0 && (
                            <div className="pt-2">
                              <p className="text-[11px] text-gray-400 font-bold">Sin responder:</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {revealedResults.unrespondedParticipants.map(up => (
                                  <span key={up.id} className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded">
                                    {up.username} (tiempo)
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Tabla de Posiciones Completa */
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(revealedResults.leaderboard || []).map((p, idx) => {
                          const isMe = String(p.id) === String(user?.id);
                          return (
                            <div
                              key={p.id}
                              className={`flex items-center justify-between p-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                                isMe 
                                  ? 'bg-gold/20 border-gold text-gold-light ring-1 ring-gold' 
                                  : idx === 0 
                                  ? 'bg-amber-500/15 border-amber-400 text-amber-200' 
                                  : idx === 1 
                                  ? 'bg-slate-400/15 border-slate-300 text-slate-200' 
                                  : idx === 2 
                                  ? 'bg-amber-800/15 border-amber-700 text-amber-300' 
                                  : 'bg-white/5 border-white/10 text-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="font-bold text-sm w-7">
                                  {idx === 0 ? '🥇 1º' : idx === 1 ? '🥈 2º' : idx === 2 ? '🥉 3º' : `${idx + 1}º`}
                                </span>
                                <span>{p.username} {isMe && <span className="text-[10px] text-gold font-bold">(Tú)</span>}</span>
                              </div>
                              <span className="font-mono font-bold text-gold text-sm sm:text-base">
                                {p.score || 0} pts
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 6. Barra de Control de la Pregunta (Líder / Admin) */}
            <div className="bg-slate-900 border border-gold/30 p-3 sm:p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-white">
              <span className="text-xs text-gray-400 font-mono">
                Pregunta {currentQuestionIndex + 1} • Remanente Meet Quiz
              </span>

              {isHost ? (
                <div className="flex items-center gap-2">
                  {!revealedResults ? (
                    <button
                      onClick={handleRevealResults}
                      className={`px-4 sm:px-6 py-2.5 sm:py-3 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg transition-all cursor-pointer flex items-center gap-2 ${
                        answerStatus.allAnswered || (answerStatus.pendingParticipants && answerStatus.pendingParticipants.length === 0 && participants.length > 0)
                          ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 ring-4 ring-emerald-400 animate-bounce' 
                          : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span>
                        {answerStatus.allAnswered || (answerStatus.pendingParticipants && answerStatus.pendingParticipants.length === 0 && participants.length > 0)
                          ? '¡Todos Respondieron! Mostrar Resultados 📊' 
                          : 'Mostrar Resultados 📊'}
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={handleNextQuestion}
                      className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white rounded-xl text-xs sm:text-sm font-black shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
                    >
                      <span>
                        {revealedResults.hasNextQuestion ? `Siguiente Pregunta (${currentQuestionIndex + 2}) ➡️` : 'Ver Podio Final 🏆'}
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                  {!revealedResults ? (
                    <span>⏳ Responde tu opción y espera a que el líder revele los resultados...</span>
                  ) : (
                    <span>📖 Revisa la explicación bíblica. El líder avanzará a la siguiente pregunta.</span>
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

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 w-full">
              {isHost && !sessionClosing && (
                <button
                  onClick={handleEndMeeting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm shadow-xl transition-all cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Cerrar Reunión para Todos</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (socket) socket.disconnect();
                  navigate('/meet');
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm shadow-xl transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a la Lista de Meets</span>
              </button>
            </div>
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

      {/* MODAL OVERLAY DE CIERRE AUTOMÁTICO DE REUNIÓN (EN VIVO SIN REFRESCAR) */}
      {sessionClosing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 text-white border-2 border-red-500/80 rounded-2xl w-full max-w-lg p-6 sm:p-8 space-y-6 text-center shadow-2xl shadow-red-900/40 relative">
            
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400 animate-pulse">
              <XCircle className="w-10 h-10 sm:w-12 sm:h-12 text-red-400" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 bg-red-600/30 text-red-300 border border-red-500/40 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                <span>Sesión Finalizada</span>
              </div>
              <h2 className="font-[Cinzel] text-2xl sm:text-3xl font-bold text-white">
                Reunión Cerrada
              </h2>
              <p className="text-sm sm:text-base text-gray-300">
                {sessionClosing.message}
              </p>
              {mySessionScore > 0 && (
                <p className="text-xs sm:text-sm text-gold font-bold">
                  ✨ Tus {mySessionScore} Puntos de Sabiduría han sido guardados en tu perfil.
                </p>
              )}
            </div>

            {/* Contador regresivo con barra visual animada */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
              <p className="text-xs text-gray-400 font-medium">
                Cerrando la sala y regresando a la lista de Meets en...
              </p>
              <div className="text-3xl sm:text-4xl font-mono font-black text-gold">
                {sessionClosing.countdown}s
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-gold h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${Math.max(0, Math.min(100, (sessionClosing.countdown / 4) * 100))}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => {
                if (socket) socket.disconnect();
                navigate('/meet', { replace: true });
              }}
              className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-900/30 hover:scale-102 transition-all cursor-pointer"
            >
              Cerrar y Salir Ahora
            </button>
          </div>
        </div>
      )}

      {/* BARRA FLOTANTE UNIVERSAL DE REACCIONES (DISPONIBLE EN TODAS LAS FASES) */}
      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-30 flex items-center gap-1 sm:gap-1.5 bg-slate-900/90 backdrop-blur-md border border-gold/40 p-1 sm:p-1.5 rounded-2xl shadow-2xl shadow-black/60">
        {REACTION_EMOJIS.map(r => (
          <button
            key={r.id}
            onClick={() => sendReaction(r.id)}
            className="p-1.5 sm:p-2 hover:bg-white/20 active:scale-90 hover:scale-125 rounded-xl text-base sm:text-xl transition-all cursor-pointer"
            title={r.label}
          >
            {r.icon}
          </button>
        ))}
      </div>

    </div>
  );
};

export default MeetRoomPage;
