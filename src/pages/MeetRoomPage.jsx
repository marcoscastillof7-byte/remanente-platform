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
  Swords,
  Loader2,
  Check,
  BarChart3,
  Hourglass,
  CheckCheck,
  HelpCircle,
  Crown,
  Target,
  TrendingUp,
  Filter
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import { supabase } from '../utils/supabase';
import { playNotificationSound } from '../utils/notificationSound';
import ManageQuestionsModal from '../components/meet/ManageQuestionsModal';

export function getQuestionCorrectLetter(q) {
  if (!q) return 'a';
  const raw = String(q.correct_answer || q.correctAnswer || '').trim().toLowerCase();
  if (['a', 'b', 'c', 'd'].includes(raw)) return raw;

  const optA = String(q.option_a || q.optionA || '').trim().toLowerCase();
  const optB = String(q.option_b || q.optionB || '').trim().toLowerCase();
  const optC = String(q.option_c || q.optionC || '').trim().toLowerCase();
  const optD = String(q.option_d || q.optionD || '').trim().toLowerCase();

  if (raw && optA && raw === optA) return 'a';
  if (raw && optB && raw === optB) return 'b';
  if (raw && optC && raw === optC) return 'c';
  if (raw && optD && raw === optD) return 'd';

  const match = raw.match(/^[\(\[]?([a-d])[\)\]\.\:\-]/);
  if (match && match[1]) return match[1];

  return raw || 'a';
}

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
  const [currentReader, setCurrentReader] = useState(null);
  const [laserPointer, setLaserPointer] = useState({ x: 0, y: 0, active: false });
  const [laserModeActive, setLaserModeActive] = useState(false);

  // Estados del Quiz Individual (Self-Paced por cada usuario)
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [myQuestionIndex, setMyQuestionIndex] = useState(0);
  const [myAnswers, setMyAnswers] = useState({}); // { [qIdx]: { selectedAnswer, isCorrect, points, ... } }
  const [isSelfFinished, setIsSelfFinished] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState(null); // Feedback visual inmediato tras responder
  const [timeLeft, setTimeLeft] = useState(25);
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState(null);

  // Progreso Global de la Sala
  const [quizProgress, setQuizProgress] = useState({
    totalQuestions: 0,
    totalParticipants: 0,
    finishedCount: 0,
    allFinished: false,
    participantsProgress: [],
    leaderboard: []
  });

  const [revealedResults, setRevealedResults] = useState(null);
  const [mySessionScore, setMySessionScore] = useState(0);
  const [finalPodium, setFinalPodium] = useState([]);
  const [totalJoinedCount, setTotalJoinedCount] = useState(0);
  const [platformOnlineCount, setPlatformOnlineCount] = useState(1);
  const [sessionClosing, setSessionClosing] = useState(null); // { message, countdown: 4 }
  const [liveLeaderboard, setLiveLeaderboard] = useState([]);
  const [activeResultsTab, setActiveResultsTab] = useState('posiciones'); // 'posiciones' | 'revision' | 'estadisticas' | 'global'
  const [recapFilter, setRecapFilter] = useState('todos'); // 'todos' | 'aciertos' | 'falladas'
  const [selectedUserForRecap, setSelectedUserForRecap] = useState(null); // null = current user
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [loadingGlobalLeaderboard, setLoadingGlobalLeaderboard] = useState(false);
  const [isManageQuestionsOpen, setIsManageQuestionsOpen] = useState(false);

  const isHost = meet && (String(user?.id) === String(meet.host_id) || ['admin', 'superadmin', 'lider', 'leader'].includes(user?.role?.toLowerCase()));
  const pdfContainerRef = useRef(null);
  const broadcastChannelRef = useRef(null);

  // Lista activa de preguntas con soporte para preguntas completas reveladas
  const activeQuestions = (() => {
    if (revealedResults?.fullQuestions && Array.isArray(revealedResults.fullQuestions) && revealedResults.fullQuestions.length > 0) {
      return revealedResults.fullQuestions;
    }
    if (revealedResults?.questionsResults && Array.isArray(revealedResults.questionsResults) && revealedResults.questionsResults.length > 0) {
      return revealedResults.questionsResults;
    }
    if (quizQuestions && quizQuestions.length > 0) {
      return quizQuestions;
    }
    return meet?.questions || [];
  })();
  const currentQuestion = activeQuestions[myQuestionIndex] || null;
  const myCorrectCount = activeQuestions.reduce((acc, q, idx) => {
    const ans = myAnswers[idx];
    if (ans && ans.isCorrect) return acc + 1;
    return acc;
  }, 0);
  const connectedParticipants = participants.filter(p => p.connected !== false);
  const connectedCount = Math.max(1, connectedParticipants.length);

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
      if (data?.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        setQuizQuestions(data.questions);
      }
    } catch (err) {
      console.error('Error cargando meet:', err);
      alert('Error cargando la sala Meet.');
      navigate('/meet');
    } finally {
      setLoading(false);
    }
  };

  // Blindaje y recuperación inmediata local anti-recarga (Anti-F5 / Anti-Rejoin)
  useEffect(() => {
    if (!id || !user?.id) return;
    const cacheKey = `meet_quiz_${id}_${user.id}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.answers && Object.keys(parsed.answers).length > 0) {
          setMyAnswers(prev => ({ ...parsed.answers, ...prev }));
          if (parsed.questionIndex !== undefined) {
            setMyQuestionIndex(prev => Math.max(prev, parsed.questionIndex));
          }
          if (parsed.isFinished) setIsSelfFinished(true);
          if (parsed.score) setMySessionScore(prev => Math.max(prev, parsed.score));
        }
      }
    } catch (e) {}
  }, [id, user?.id]);

  useEffect(() => {
    if (!id || !user?.id) return;
    const cacheKey = `meet_quiz_${id}_${user.id}`;
    if (Object.keys(myAnswers).length > 0) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          answers: myAnswers,
          questionIndex: myQuestionIndex,
          isFinished: isSelfFinished,
          score: mySessionScore
        }));
      } catch (e) {}
    }
  }, [myAnswers, myQuestionIndex, isSelfFinished, mySessionScore, id, user?.id]);

  // Inicializar Socket.io con reconexión robusta
  useEffect(() => {
    if (!user || !meet) return;

    const socketUrl = window.location.port === '5173' 
      ? `${window.location.protocol}//${window.location.hostname}:3001` 
      : window.location.origin;
    const s = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 10000
    });

    setSocket(s);

    const joinRoom = () => {
      if (s) {
        s.emit('meet:join', { meetId: id, user });
      }
    };

    s.on('connect', joinRoom);
    s.on('reconnect', joinRoom);
    if (s.io) {
      s.io.on('reconnect', joinRoom);
    }
    joinRoom();

    const handleWindowOnline = () => joinRoom();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        joinRoom();
      }
    };
    window.addEventListener('online', handleWindowOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Estado inicial de la sala (al entrar o reconectar)
    s.on('meet:initial-state', (state) => {
      setPhase(state.phase || 'reading');
      setCurrentPage(state.currentPage || 1);
      setCurrentReader(state.currentReader || null);
      setParticipants(state.participants || []);

      if (state.questions && state.questions.length > 0) {
        setQuizQuestions(state.questions);
      }

      if (state.quizProgress) {
        setQuizProgress(state.quizProgress);
        if (state.quizProgress.leaderboard) {
          setLiveLeaderboard(state.quizProgress.leaderboard);
        }
      }

      if (state.myAnswers && Array.isArray(state.myAnswers)) {
        const answersMap = {};
        state.myAnswers.forEach(ans => {
          answersMap[ans.questionIndex] = ans;
        });
        setMyAnswers(answersMap);
        const answeredCount = Object.keys(answersMap).length;
        setMyQuestionIndex(answeredCount);
        if (state.myIsFinished || (state.questions && answeredCount >= state.questions.length)) {
          setIsSelfFinished(true);
        }
      }

      if (state.myScore !== undefined) {
        setMySessionScore(state.myScore);
      }

      if (state.revealedResults) {
        setRevealedResults(state.revealedResults);
        setPhase('finished');
        if (state.revealedResults.podium) setFinalPodium(state.revealedResults.podium);
        if (state.revealedResults.leaderboard) setLiveLeaderboard(state.revealedResults.leaderboard);
        if (state.revealedResults.fullQuestions && Array.isArray(state.revealedResults.fullQuestions) && state.revealedResults.fullQuestions.length > 0) {
          setQuizQuestions(state.revealedResults.fullQuestions);
        }
        if (state.revealedResults.allUserAnswers && user?.id && state.revealedResults.allUserAnswers[String(user.id)]) {
          setMyAnswers(prev => ({
            ...state.revealedResults.allUserAnswers[String(user.id)],
            ...prev
          }));
        }
      }

      if (state.totalJoinedCount) setTotalJoinedCount(state.totalJoinedCount);
      if (state.platformOnlineCount) setPlatformOnlineCount(state.platformOnlineCount);
    });

    s.on('meet:participants-updated', ({ participants: pts, totalJoinedCount: tjc, platformOnlineCount: poc }) => {
      setParticipants(pts || []);
      if (tjc) setTotalJoinedCount(tjc);
      if (poc) setPlatformOnlineCount(poc);
    });

    s.on('platform:online-stats', (data) => {
      if (data && typeof data.onlineCount === 'number') {
        setPlatformOnlineCount(Math.max(1, data.onlineCount));
      }
    });

    s.on('meet:page-synced', ({ page }) => {
      setCurrentPage(page);
    });

    s.on('meet:laser-synced', (laser) => {
      setLaserPointer(laser);
    });

    s.on('meet:reader-assigned', ({ reader }) => {
      setCurrentReader(reader);
      if (reader && String(reader.id) === String(user.id)) {
        playNotificationSound();
        alert('📖 ¡El líder te ha asignado como lector de este pasaje!');
      }
    });

    s.on('meet:phase-changed', ({ phase: newPhase, meetId: pMeetId, questions: pQuestions }) => {
      if (pMeetId && pMeetId !== 'all' && String(pMeetId).trim() !== String(id).trim()) {
        return;
      }
      setPhase(newPhase);
      if (pQuestions && Array.isArray(pQuestions) && pQuestions.length > 0) {
        setQuizQuestions(pQuestions);
      }
      if (newPhase === 'quiz') {
        setIsSelfFinished(false);
        setCurrentFeedback(null);
        setRevealedResults(null);
        setMyQuestionIndex(0);
        setMyAnswers({});
        playNotificationSound();
      }
      // Nota: phase === 'finished' muestra resultados, podio y recap. NO cierra la sala.
    });

    // Evento de inicio del Quiz: cada persona recibe el set completo y empieza a responder a su ritmo
    s.on('meet:quiz-started', ({ questions: qList, totalQuestions, progress }) => {
      setPhase('quiz');
      if (qList && qList.length > 0) setQuizQuestions(qList);
      setMyQuestionIndex(0);
      setMyAnswers({});
      setIsSelfFinished(false);
      setCurrentFeedback(null);
      setRevealedResults(null);
      setTimeLeft(qList?.[0]?.time_limit_seconds || 25);
      if (progress) {
        setQuizProgress(progress);
        if (progress.leaderboard) setLiveLeaderboard(progress.leaderboard);
      }
      playNotificationSound();
    });

    // Actualización en tiempo real del progreso de todos los participantes
    s.on('meet:quiz-progress-updated', (progress) => {
      if (progress) {
        setQuizProgress(progress);
        if (progress.leaderboard) setLiveLeaderboard(progress.leaderboard);
      }
    });

    s.on('meet:all-participants-finished', (progress) => {
      if (progress) {
        setQuizProgress(progress);
        if (progress.leaderboard) setLiveLeaderboard(progress.leaderboard);
      }
      playNotificationSound();
    });

    // El líder revela los resultados finales y el podio para todos (incluso si no han terminado)
    s.on('meet:quiz-results-revealed', (results) => {
      if (results?.meetId && results.meetId !== 'all' && String(results.meetId).trim() !== String(id).trim()) {
        return;
      }
      if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer);
        setAutoAdvanceTimer(null);
      }
      setRevealedResults(results);
      setPhase('finished');
      if (results.leaderboard) setLiveLeaderboard(results.leaderboard);
      if (results.podium) setFinalPodium(results.podium);
      if (results.fullQuestions && Array.isArray(results.fullQuestions) && results.fullQuestions.length > 0) {
        setQuizQuestions(results.fullQuestions);
      }
      if (results.allUserAnswers && user?.id && results.allUserAnswers[String(user.id)]) {
        setMyAnswers(prev => ({
          ...results.allUserAnswers[String(user.id)],
          ...prev
        }));
      }
      const me = (results.leaderboard || []).find(p => String(p.id) === String(user?.id));
      if (me && me.score !== undefined) {
        setMySessionScore(me.score);
      }
      playNotificationSound();
    });

    // Confirmación autoritativa de respuesta enviada por socket
    s.on('meet:answer-received', (res) => {
      if (res && res.questionIndex !== undefined) {
        setMyAnswers(prev => ({
          ...prev,
          [res.questionIndex]: {
            selectedAnswer: res.selectedAnswer,
            isCorrect: res.isCorrect,
            points: res.points,
            correctAnswer: res.correctAnswer,
            explanation: res.explanation,
            verseReference: res.verseReference
          }
        }));
        if (res.totalScore !== undefined) {
          setMySessionScore(res.totalScore);
        }
      }
    });


    s.on('meet:questions-updated', ({ questions: updatedQs, count }) => {
      setMeet(prev => prev ? {
        ...prev,
        questions: updatedQs,
        questionsCount: count
      } : prev);
      if (updatedQs && updatedQs.length > 0) {
        setQuizQuestions(updatedQs);
      }
    });

    s.on('meet:error', ({ message }) => {
      if (message) alert(message);
    });

    s.on('meet:final-podium', ({ podium, totalJoinedCount: tjc, platformOnlineCount: poc, meetId: pMeetId }) => {
      if (pMeetId && pMeetId !== 'all' && String(pMeetId).trim() !== String(id).trim()) {
        return;
      }
      setFinalPodium(podium || []);
      if (tjc) setTotalJoinedCount(tjc);
      if (poc) setPlatformOnlineCount(poc);
      setPhase('finished');
      playNotificationSound();
    });

    s.on('meet:session-ended', ({ message, podium, meetId: endedMeetId, totalJoinedCount: tjc, platformOnlineCount: poc }) => {
      if (endedMeetId && endedMeetId !== 'all' && String(endedMeetId).trim() !== String(id).trim()) {
        return;
      }
      if (podium && Array.isArray(podium) && podium.length > 0) {
        setFinalPodium(podium);
      }
      if (tjc) setTotalJoinedCount(tjc);
      if (poc) setPlatformOnlineCount(poc);
      setPhase('finished');
      playNotificationSound();
      setSessionClosing(prev => prev || {
        message: message || 'La reunión ha sido finalizada por el líder.',
        countdown: 4
      });
    });

    return () => {
      window.removeEventListener('online', handleWindowOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      s.disconnect();
    };
  }, [user, meet, id]);

  // Canal Supabase Realtime: Respaldo de sincronización inmediata para todos los participantes
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`meet-realtime-room-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings',
          filter: `id=eq.${id}`
        },
        (payload) => {
          if (payload.new && payload.new.status === 'ended') {
            setSessionClosing(prev => prev || {
              message: 'La reunión ha sido finalizada por el líder.',
              countdown: 4
            });
            return;
          }

          if (payload.new?.description) {
            try {
              const meta = JSON.parse(payload.new.description);
              // Transición automática a quiz si el líder inició
              if (meta.phase === 'quiz' && phase === 'reading') {
                setPhase('quiz');
                if (meta.questions && Array.isArray(meta.questions) && meta.questions.length > 0) {
                  setQuizQuestions(meta.questions);
                }
                setMyQuestionIndex(0);
                setMyAnswers({});
                setIsSelfFinished(false);
                setCurrentFeedback(null);
                setRevealedResults(null);
                setTimeLeft(meta.questions?.[0]?.time_limit_seconds || 25);
                playNotificationSound();
              }
              // Transición automática a finished si se revelaron resultados
              if (meta.revealedResults && (!revealedResults || phase !== 'finished')) {
                if (autoAdvanceTimer) {
                  clearTimeout(autoAdvanceTimer);
                  setAutoAdvanceTimer(null);
                }
                setRevealedResults(meta.revealedResults);
                setPhase('finished');
                if (meta.revealedResults.leaderboard) setLiveLeaderboard(meta.revealedResults.leaderboard);
                if (meta.revealedResults.podium) setFinalPodium(meta.revealedResults.podium);
                if (meta.revealedResults.fullQuestions) setQuizQuestions(meta.revealedResults.fullQuestions);
                playNotificationSound();
              }
            } catch (e) {}
          }
        }
      )
      .on('broadcast', { event: 'meet:quiz-started' }, ({ payload }) => {
        setPhase('quiz');
        if (payload?.questions && Array.isArray(payload.questions) && payload.questions.length > 0) {
          setQuizQuestions(payload.questions);
        }
        setMyQuestionIndex(0);
        setMyAnswers({});
        setIsSelfFinished(false);
        setCurrentFeedback(null);
        setRevealedResults(null);
        setTimeLeft(payload?.questions?.[0]?.time_limit_seconds || 25);
        playNotificationSound();
      })
      .on('broadcast', { event: 'meet:quiz-results-revealed' }, ({ payload }) => {
        const results = payload?.results || payload;
        if (results && (results.leaderboard || results.podium)) {
          if (autoAdvanceTimer) {
            clearTimeout(autoAdvanceTimer);
            setAutoAdvanceTimer(null);
          }
          setRevealedResults(results);
          setPhase('finished');
          if (results.leaderboard) setLiveLeaderboard(results.leaderboard);
          if (results.podium) setFinalPodium(results.podium);
          if (results.fullQuestions && Array.isArray(results.fullQuestions) && results.fullQuestions.length > 0) {
            setQuizQuestions(results.fullQuestions);
          }
          if (results.allUserAnswers && user?.id && results.allUserAnswers[String(user.id)]) {
            setMyAnswers(prev => ({
              ...results.allUserAnswers[String(user.id)],
              ...prev
            }));
          }
          playNotificationSound();
        }
      })
      .subscribe();

    broadcastChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user, phase, revealedResults, autoAdvanceTimer]);

  // Heartbeat Polling de sincronización continua (cada 2.5s)
  useEffect(() => {
    if (!id || sessionClosing) return;

    const checkSync = async () => {
      try {
        const res = await api.get(`/meetings/${id}`, false);
        if (res && res.status === 'ended') {
          setSessionClosing(prev => prev || {
            message: 'La reunión ha sido finalizada por el líder.',
            countdown: 4
          });
          return;
        }

        // 1. Sincronización automática de fase Quiz
        if (res?.phase === 'quiz' && phase === 'reading') {
          setPhase('quiz');
          if (res.questions && Array.isArray(res.questions) && res.questions.length > 0) {
            setQuizQuestions(res.questions);
          }
          setMyQuestionIndex(0);
          setMyAnswers({});
          setIsSelfFinished(false);
          setCurrentFeedback(null);
          setRevealedResults(null);
          setTimeLeft(res.questions?.[0]?.time_limit_seconds || 25);
          playNotificationSound();
        }

        // 2. Sincronización automática si el líder reveló resultados
        if ((res?.phase === 'finished' || res?.revealedResults) && (!revealedResults || phase !== 'finished')) {
          const results = res.revealedResults || {
            leaderboard: res.quizProgress?.leaderboard || [],
            podium: res.quizProgress?.leaderboard || [],
            fullQuestions: res.questions || []
          };
          if (autoAdvanceTimer) {
            clearTimeout(autoAdvanceTimer);
            setAutoAdvanceTimer(null);
          }
          setRevealedResults(results);
          setPhase('finished');
          if (results.leaderboard) setLiveLeaderboard(results.leaderboard);
          if (results.podium) setFinalPodium(results.podium);
          if (results.fullQuestions && Array.isArray(results.fullQuestions) && results.fullQuestions.length > 0) {
            setQuizQuestions(results.fullQuestions);
          }
          playNotificationSound();
        }
      } catch (err) {}
    };

    const interval = setInterval(checkSync, 2500);
    return () => clearInterval(interval);
  }, [id, sessionClosing, phase, revealedResults, autoAdvanceTimer]);

  // Recuperación automática de preguntas si estamos en fase Quiz y no se cargaron
  useEffect(() => {
    if (phase === 'quiz' && (!quizQuestions || quizQuestions.length === 0)) {
      api.get(`/meetings/${id}`).then(data => {
        if (data?.questions && Array.isArray(data.questions) && data.questions.length > 0) {
          setQuizQuestions(data.questions);
        }
      }).catch(() => {});
    }
  }, [phase, quizQuestions?.length, id]);

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

  // Salida limpia y sincronizada al cerrar pestaña o navegador
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socket && socket.connected) {
        socket.emit('meet:leave', { meetId: id, user });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (socket && socket.connected) {
        socket.emit('meet:leave', { meetId: id, user });
      }
    };
  }, [id, user, socket]);

  // Cargar tabla de honor global cuando se activa la pestaña 'global'
  useEffect(() => {
    if (activeResultsTab === 'global' && globalLeaderboard.length === 0) {
      setLoadingGlobalLeaderboard(true);
      api.get('/leaderboard')
        .then(data => {
          if (Array.isArray(data)) setGlobalLeaderboard(data.slice(0, 15));
        })
        .catch(err => console.warn('[Meet] Error cargando tabla de honor global:', err))
        .finally(() => setLoadingGlobalLeaderboard(false));
    }
  }, [activeResultsTab, globalLeaderboard.length]);

  // 1. AVANZAR A LA SIGUIENTE PREGUNTA DEL SET O FINALIZAR
  const handleGoToNextQuestion = () => {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      setAutoAdvanceTimer(null);
    }

    const nextIdx = myQuestionIndex + 1;
    setCurrentFeedback(null);

    if (nextIdx < activeQuestions.length) {
      setMyQuestionIndex(nextIdx);
      setTimeLeft(activeQuestions[nextIdx]?.time_limit_seconds || 25);
    } else {
      // Completó todas las preguntas del set -> Pasa a Pantalla de Espera
      setIsSelfFinished(true);
      playNotificationSound();
    }
  };

  // 2. RESPUESTA AUTOMÁTICA POR TIEMPO AGOTADO (0 PUNTOS, SIN BENEFICIO)
  const handleAnswerTimeout = () => {
    if (currentFeedback || isSelfFinished || revealedResults) return;

    const currentQ = activeQuestions[myQuestionIndex];
    if (!currentQ) return;

    const limitSec = currentQ.time_limit_seconds || 25;
    const correctLetter = getQuestionCorrectLetter(currentQ);

    const feedbackObj = {
      selectedAnswer: 'timeout',
      isCorrect: false,
      points: 0,
      isTimeout: true,
      correctAnswer: correctLetter,
      explanation: currentQ.explanation || currentQ.explanationText || 'Fundamentado en las Sagradas Escrituras.',
      verseReference: currentQ.verse_reference || currentQ.verseReference || ''
    };

    setCurrentFeedback(feedbackObj);
    playNotificationSound();

    setMyAnswers(prev => ({
      ...prev,
      [myQuestionIndex]: feedbackObj
    }));

    // 1. Envío WebSocket (0ms)
    if (socket && socket.connected) {
      socket.emit('meet:submit-answer', {
        meetId: id,
        questionIndex: myQuestionIndex,
        selectedAnswer: 'timeout',
        timeTakenMs: limitSec * 1000,
        user
      });
    }

    // 2. Respaldo HTTP infalible
    api.post(`/meetings/${id}/submit-answer`, {
      questionIndex: myQuestionIndex,
      selectedAnswer: 'timeout',
      timeTakenMs: limitSec * 1000
    }).catch(err => console.warn('[Meet] Respaldo HTTP submit timeout:', err));

    // Auto-avance suave después de 1.8 segundos a la siguiente pregunta
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    const advanceTimeout = setTimeout(() => {
      handleGoToNextQuestion();
    }, 1800);
    setAutoAdvanceTimer(advanceTimeout);
  };

  // 3. RESPONDER UNA PREGUNTA EN EL SET INDIVIDUAL
  const handleAnswerSelect = async (optKey) => {
    if (currentFeedback || isSelfFinished || revealedResults) return;

    const currentQ = activeQuestions[myQuestionIndex];
    if (!currentQ) return;

    const limitSec = currentQ.time_limit_seconds || 25;
    const timeTakenMs = Math.max(500, (limitSec - timeLeft) * 1000);

    // Detección local infalible de respuesta correcta para feedback visual instantáneo (0ms)
    const correctLetter = getQuestionCorrectLetter(currentQ);
    const isCorrect = optKey === correctLetter;
    let points = 0;
    if (isCorrect) {
      const limitMs = limitSec * 1000;
      const timeLeftRatio = Math.max(0, Math.min(1, 1 - (timeTakenMs / limitMs)));
      points = 50 + Math.round(timeLeftRatio * 50);
    }

    const feedbackObj = {
      selectedAnswer: optKey,
      isCorrect,
      points,
      correctAnswer: correctLetter,
      explanation: currentQ.explanation || currentQ.explanationText || 'Fundamentado en las Sagradas Escrituras.',
      verseReference: currentQ.verse_reference || currentQ.verseReference || ''
    };

    setCurrentFeedback(feedbackObj);
    playNotificationSound();

    if (points > 0) {
      setMySessionScore(prev => prev + points);
    }

    setMyAnswers(prev => ({
      ...prev,
      [myQuestionIndex]: feedbackObj
    }));

    // 1. Envío WebSocket (0ms)
    if (socket && socket.connected) {
      socket.emit('meet:submit-answer', {
        meetId: id,
        questionIndex: myQuestionIndex,
        selectedAnswer: optKey,
        timeTakenMs,
        user
      });
    }

    // 2. Respaldo HTTP infalible
    api.post(`/meetings/${id}/submit-answer`, {
      questionIndex: myQuestionIndex,
      selectedAnswer: optKey,
      timeTakenMs
    }).then(res => {
      if (res && res.points && res.points > 0) {
        setMySessionScore(prev => Math.max(prev, res.totalScore || prev));
      }
    }).catch(err => console.warn('[Meet] Respaldo HTTP submit-answer:', err));

    // Auto-avance suave después de 2.2 segundos si no hace clic manual
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    const advanceTimeout = setTimeout(() => {
      handleGoToNextQuestion();
    }, 2200);
    setAutoAdvanceTimer(advanceTimeout);
  };

  // Temporizador para cada pregunta individual con avance automático al llegar a 0
  useEffect(() => {
    if (phase !== 'quiz' || isSelfFinished || currentFeedback || revealedResults) return;

    if (timeLeft <= 0) {
      handleAnswerTimeout();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, timeLeft, isSelfFinished, currentFeedback, revealedResults, myQuestionIndex]);

  // Controles de Página del Líder
  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
    if (socket) {
      socket.emit('meet:change-page', { meetId: id, page: newPage });
    }
  };

  // Movimiento del Puntero Láser
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

  // 3. LÍDER INICIA EL QUIZ PARA TODOS LOS PARTICIPANTES
  const handleStartQuiz = async () => {
    const qToSend = (activeQuestions && activeQuestions.length > 0) ? activeQuestions : (meet?.questions || []);
    
    // Configuración inmediata local del líder
    setPhase('quiz');
    setMyQuestionIndex(0);
    setMyAnswers({});
    setIsSelfFinished(false);
    setCurrentFeedback(null);
    setRevealedResults(null);
    setTimeLeft(qToSend?.[0]?.time_limit_seconds || 25);
    playNotificationSound();

    // 1. Envío WebSocket (0ms)
    if (socket && socket.connected) {
      socket.emit('meet:start-quiz', { meetId: id, questions: qToSend });
    }

    // 2. Transmisión Supabase Realtime Broadcast (dispositivos móviles y redes alternativas)
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'meet:quiz-started',
        payload: { meetId: id, questions: qToSend }
      }).catch(() => {});
    }

    // 3. Respaldo HTTP que actualiza la base de datos
    try {
      const res = await api.post(`/meetings/${id}/start-quiz`, { questions: qToSend });
      if (res?.questions && Array.isArray(res.questions) && res.questions.length > 0) {
        setQuizQuestions(res.questions);
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.send({
            type: 'broadcast',
            event: 'meet:quiz-started',
            payload: { meetId: id, questions: res.questions }
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[Meet] Respaldo HTTP start-quiz:', err);
    }
  };

  // 4. LÍDER REVELA RESULTADOS Y PODIO FINAL PARA TODOS (AUN SI NO HAN TERMINADO)
  const handleRevealQuizResults = async () => {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      setAutoAdvanceTimer(null);
    }

    // 1. Envío WebSocket (0ms)
    if (socket && socket.connected) {
      socket.emit('meet:reveal-quiz-results', { meetId: id });
    }

    // 2. Transmisión Supabase Realtime Broadcast inmediata
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'meet:quiz-results-revealed',
        payload: { meetId: id }
      }).catch(() => {});
    }

    // 3. Respaldo HTTP infalible que procesa puntuaciones y persiste en base de datos
    try {
      const res = await api.post(`/meetings/${id}/reveal-results`, {});
      const resultsData = res?.results || (res?.podium ? res : null);
      if (resultsData) {
        setRevealedResults(resultsData);
        setPhase('finished');
        if (resultsData.leaderboard) setLiveLeaderboard(resultsData.leaderboard);
        if (resultsData.podium) setFinalPodium(resultsData.podium);
        if (resultsData.fullQuestions && Array.isArray(resultsData.fullQuestions) && resultsData.fullQuestions.length > 0) {
          setQuizQuestions(resultsData.fullQuestions);
        }
        if (resultsData.allUserAnswers && user?.id && resultsData.allUserAnswers[String(user.id)]) {
          setMyAnswers(prev => ({
            ...resultsData.allUserAnswers[String(user.id)],
            ...prev
          }));
        }

        // Re-transmitir datos completos por Supabase Realtime broadcast para todos los participantes
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.send({
            type: 'broadcast',
            event: 'meet:quiz-results-revealed',
            payload: resultsData
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[Meet] Respaldo HTTP reveal-results:', err);
    }
  };

  // 5. LÍDER CIERRA LA REUNIÓN PARA TODOS
  const handleEndMeeting = async () => {
    if (!confirm('¿Deseas finalizar y cerrar esta reunión en vivo para todos los miembros? Se registrarán las puntuaciones acumuladas y se cerrará la sala automáticamente.')) return;
    
    if (socket && socket.connected) {
      socket.emit('meet:end-session', { meetId: id });
    }

    try {
      await api.post(`/meetings/${id}/end-session`, {});
    } catch (e) {
      console.warn('[Meet] Respaldo HTTP end-session:', e);
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
                Meet {phase === 'reading' ? '• Lectura' : phase === 'quiz' ? (isSelfFinished ? '• En Espera' : '• Quiz') : '• Podio'}
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
            <div className="bg-amber-500/20 border border-amber-500/40 px-3 py-1 rounded-full text-amber-300 font-bold flex items-center gap-1.5 shadow-inner">
              <Award className="w-4 h-4 text-gold" />
              <span>Mis Puntos: <strong className="text-white font-mono">{mySessionScore}</strong></span>
            </div>
          )}
        </div>

        {/* Derecha: Participantes y Controles Maestros */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="bg-white/10 text-gray-200 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border border-white/10 shadow-inner">
            <div className="flex items-center gap-1" title={`${connectedCount} personas conectadas en esta sala en vivo`}>
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold shrink-0" />
              <span className="text-[11px] sm:text-xs font-bold text-white">{connectedCount}</span>
              <span className="hidden sm:inline text-gray-300">en sala</span>
            </div>
            <span className="text-gray-500">•</span>
            <div className="flex items-center gap-1" title={`${platformOnlineCount} personas conectadas en toda la plataforma`}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              <span className="text-[11px] sm:text-xs font-bold text-emerald-300">{platformOnlineCount}</span>
              <span className="hidden sm:inline text-gray-300">en plataforma</span>
            </div>
          </div>

          {/* Botón Maestro del Líder para Gestionar / Importar Preguntas */}
          {isHost && (
            <button
              onClick={() => setIsManageQuestionsOpen(true)}
              className="inline-flex items-center gap-1 sm:gap-1.5 bg-blue-600/80 hover:bg-blue-600 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer hover:scale-105"
              title="Gestionar o importar preguntas bíblicas para esta reunión"
            >
              <FileText className="w-3.5 h-3.5 text-gold" />
              <span className="hidden sm:inline">Preguntas ({activeQuestions.length})</span>
            </button>
          )}

          {/* Botón Maestro del Líder para Iniciar Quiz */}
          {isHost && phase === 'reading' && (
            <button
              onClick={handleStartQuiz}
              className="inline-flex items-center gap-1 sm:gap-1.5 bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white px-2 sm:px-3.5 py-1.5 rounded-lg text-xs font-black shadow-lg transition-all animate-pulse"
            >
              <Swords className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Iniciar Quiz</span>
              <span>⚔️</span>
            </button>
          )}

          {/* Botón Maestro del Líder para Mostrar Resultados y Podio */}
          {isHost && phase === 'quiz' && !revealedResults && (
            <button
              onClick={handleRevealQuizResults}
              className={`inline-flex items-center gap-1 sm:gap-1.5 text-white px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-black shadow-lg transition-all cursor-pointer hover:scale-105 ${
                quizProgress.allFinished 
                  ? 'bg-gradient-to-r from-emerald-500 to-green-500 animate-bounce ring-2 ring-emerald-300 text-slate-900' 
                  : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500'
              }`}
              title="Mostrar resultados y podio a todos los participantes"
            >
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">
                {quizProgress.allFinished ? '¡Podio Listo!' : 'Mostrar Resultados'}
              </span>
              <span>📊</span>
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
              <span className="hidden sm:inline">Cerrar</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. ÁREA PRINCIPAL SEGÚN LA FASE */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-950/80 relative overflow-hidden">
        
        {/* ---------------- FASE A: LECTURA GUIADA ---------------- */}
        {phase === 'reading' && (
          <div className="flex-1 flex flex-col min-h-0 relative">
            <div 
              ref={pdfContainerRef}
              onMouseMove={handleMouseMove}
              onTouchMove={handleTouchMove}
              onTouchStart={handleTouchStart}
              onMouseLeave={handlePointerLeave}
              className="flex-1 w-full bg-slate-900 relative overflow-hidden select-none"
            >
              {meet.pdfUrl ? (
                <iframe
                  src={getUniversalPdfViewerUrl(meet.pdfUrl, currentPage)}
                  className="w-full h-full border-0 pointer-events-auto"
                  title="Visor Bíblico"
                  allow="fullscreen"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-gray-400 space-y-4">
                  <BookOpen className="w-16 h-16 text-gold/50" />
                  <div>
                    <h3 className="font-[Cinzel] text-lg text-white font-bold">
                      {meet.bookName || 'Estudio Bíblico'}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-300 max-w-md mt-1">
                      {meet.descriptionText || 'Reunión en vivo para escudriñar las Sagradas Escrituras.'}
                    </p>
                  </div>
                  {isHost && (
                    <button
                      onClick={handleStartQuiz}
                      className="px-5 py-2.5 bg-gradient-to-r from-gold to-gold-dark text-white rounded-xl font-bold text-xs shadow-lg hover:scale-105 transition-all animate-pulse"
                    >
                      Comenzar Ronda de Quiz ⚔️
                    </button>
                  )}
                </div>
              )}

              {/* Puntero Láser Virtual */}
              {laserPointer.active && (
                <div 
                  className="absolute pointer-events-none w-4 h-4 rounded-full bg-red-500 shadow-[0_0_15px_#ef4444] transform -translate-x-1/2 -translate-y-1/2 z-30 transition-all duration-75 ease-out animate-pulse ring-2 ring-white/80"
                  style={{ left: `${laserPointer.x}%`, top: `${laserPointer.y}%` }}
                />
              )}
            </div>

            {/* Barra de Controles de Lectura */}
            <div className="bg-slate-900 border-t border-gold/30 px-3 py-2 flex items-center justify-between text-white shrink-0 z-20">
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

              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[11px] text-gray-400 font-medium hidden xs:inline">
                  Remanente Meet • Lectura Bíblica
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- FASE B: QUIZ EN VIVO (CADA PERSONA A SU RITMO) ---------------- */}
        {phase === 'quiz' && !revealedResults && (
          !isSelfFinished ? (
            /* SUB-FASE B.1: CUESTIONARIO INDIVIDUAL EN CURSO */
            currentQuestion ? (
              <div className="flex-1 flex flex-col justify-between p-3.5 sm:p-6 md:p-8 pb-16 sm:pb-8 max-w-4xl mx-auto w-full overflow-y-auto space-y-4">
                
                {/* 1. Barra de Progreso Personal, Temporizador y Puntos */}
                <div className="bg-slate-900/90 border border-gold/30 p-3 sm:p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-white">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] sm:text-xs font-black text-gold uppercase tracking-wider bg-gold/15 px-2.5 py-0.5 rounded-full border border-gold/30">
                        Pregunta {myQuestionIndex + 1} de {activeQuestions.length}
                      </span>
                      <span className="text-[11px] sm:text-xs text-gray-300 font-semibold hidden xs:inline">
                        • {quizProgress.finishedCount} de {quizProgress.totalParticipants || participants.length} completaron
                      </span>
                    </div>
                    {/* Barra de progreso de preguntas respondidas */}
                    <div className="w-36 sm:w-56 bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div 
                        className="bg-gold h-full transition-all duration-300"
                        style={{ width: `${activeQuestions.length > 0 ? ((myQuestionIndex) / activeQuestions.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="bg-white/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-white/15 text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-gold" />
                      <span>Mis Puntos: <strong className="text-white font-mono">{mySessionScore}</strong></span>
                    </div>

                    {!currentFeedback && (
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

                {/* Banner de Supervisión para el Líder si está respondiendo */}
                {isHost && (
                  <div className="bg-blue-950/40 border border-blue-500/40 p-2.5 rounded-xl flex items-center justify-between text-xs text-blue-200">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gold">👑 Panel Líder:</span>
                      <span>{quizProgress.finishedCount} de {quizProgress.totalParticipants || participants.length} completaron todas las preguntas.</span>
                    </div>
                    <button
                      onClick={handleRevealQuizResults}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-[11px] transition-all cursor-pointer shadow"
                    >
                      Mostrar Resultados 📊
                    </button>
                  </div>
                )}

                {/* 2. Tarjeta Principal de la Pregunta */}
                <div className="bg-slate-900 border-2 border-gold/50 p-4 sm:p-6 rounded-2xl shadow-xl text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full blur-2xl pointer-events-none" />
                  <h2 className="font-[Cinzel] text-lg sm:text-2xl font-bold text-white leading-relaxed">
                    {currentQuestion.question_text || currentQuestion.questionText}
                  </h2>
                </div>

                {/* Barra Visual del Cronómetro */}
                {!currentFeedback && (
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-white/10">
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
                    const optText = currentQuestion[`option_${optKey}`] || currentQuestion[`option${optKey.toUpperCase()}`];
                    if (!optText) return null;

                    const isSelected = currentFeedback?.selectedAnswer === optKey;
                    const isCorrect = currentFeedback && currentFeedback.correctAnswer === optKey;
                    const isWrongSelected = currentFeedback && isSelected && !isCorrect;

                    let btnStyle = 'bg-slate-900 hover:bg-slate-800 border-gray-700 text-gray-200';
                    if (isCorrect) {
                      btnStyle = 'bg-green-600/30 border-green-500 text-green-200 ring-2 ring-green-500 font-bold';
                    } else if (isWrongSelected) {
                      btnStyle = 'bg-red-600/30 border-red-500 text-red-200 ring-2 ring-red-500';
                    }

                    return (
                      <button
                        key={optKey}
                        disabled={!!currentFeedback}
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
                          {isCorrect && <CheckCircle className="w-5 h-5 text-green-400" />}
                          {isWrongSelected && <XCircle className="w-5 h-5 text-red-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 4. Feedback Inmediato y Botón de Avance */}
                {currentFeedback && (
                  <div className="bg-slate-900 border border-gold/40 p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm">
                      {currentFeedback.isTimeout ? (
                        <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                          <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 animate-pulse" />
                          <span>⏰ ¡Tiempo agotado! (0 pts) • La correcta era la ({currentFeedback.correctAnswer?.toUpperCase()})</span>
                        </div>
                      ) : currentFeedback.isCorrect ? (
                        <div className="flex items-center gap-1.5 text-green-400 font-bold">
                          <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span>¡Correcto! +{currentFeedback.points} pts</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-red-400 font-bold">
                          <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span>Respuesta incorrecta. La correcta era la ({currentFeedback.correctAnswer?.toUpperCase()})</span>
                        </div>
                      )}
                      {currentFeedback.verseReference && (
                        <span className="text-gold font-semibold italic text-xs hidden md:inline">
                          📖 {currentFeedback.verseReference}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={handleGoToNextQuestion}
                      className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white font-bold rounded-xl text-xs sm:text-sm shadow-lg transition-all cursor-pointer hover:scale-105 shrink-0 flex items-center justify-center gap-1.5"
                    >
                      <span>
                        {myQuestionIndex + 1 < activeQuestions.length ? 'Siguiente Pregunta ➡️' : 'Finalizar Cuestionario ✅'}
                      </span>
                    </button>
                  </div>
                )}

                {/* Mini estado de la sala en vivo */}
                <div className="bg-slate-900/60 border border-white/10 rounded-xl p-3 text-xs text-gray-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-gold" />
                    <span>Progreso de la sala: {quizProgress.finishedCount} de {quizProgress.totalParticipants || participants.length} completaron</span>
                  </div>
                  <span className="text-gray-400 font-mono text-[11px]">
                    {quizProgress.allFinished ? '¡Todos listos!' : 'Respondiendo a su ritmo'}
                  </span>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white space-y-4 max-w-md mx-auto">
                <Loader2 className="w-10 h-10 animate-spin text-gold" />
                <h3 className="font-[Cinzel] text-xl font-bold text-gold">Cargando Preguntas del Meet...</h3>
                <p className="text-xs sm:text-sm text-gray-300">
                  Preparando el cuestionario bíblico interactivo.
                </p>
              </div>
            )
          ) : (
            /* SUB-FASE B.2: PANTALLA DE ESPERA (TRAS COMPLETAR TODAS LAS PREGUNTAS) */
            <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6 md:p-8 max-w-3xl mx-auto w-full overflow-y-auto space-y-5 animate-fadeIn">
              
              {/* Encabezado Celebratorio */}
              <div className="text-center space-y-2">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-gold/20 border-2 border-gold flex items-center justify-center text-gold shadow-lg shadow-gold/20 animate-pulse">
                  <Hourglass className="w-8 h-8 sm:w-10 sm:h-10 text-gold" />
                </div>
                <h2 className="font-[Cinzel] text-xl sm:text-3xl font-bold text-gold">
                  ¡Has completado todas las preguntas bíblicas!
                </h2>
                <p className="text-xs sm:text-sm text-gray-300 max-w-md mx-auto">
                  Excelente trabajo escudriñando las Escrituras. Ahora estamos esperando a que los demás hermanos terminen para revelar los resultados finales y el podio.
                </p>
              </div>

              {/* Tarjeta de Resumen Personal */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-lg">
                <div className="bg-slate-900 border border-gold/40 p-3 rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Mis Puntos</span>
                  <span className="text-lg sm:text-2xl font-black text-amber-300 font-mono">{mySessionScore}</span>
                </div>
                <div className="bg-slate-900 border border-green-500/40 p-3 rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Acertadas</span>
                  <span className="text-lg sm:text-2xl font-black text-green-400 font-mono">{myCorrectCount}/{activeQuestions.length}</span>
                </div>
                <div className="bg-slate-900 border border-blue-500/40 p-3 rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Estatus</span>
                  <span className="text-xs sm:text-sm font-bold text-blue-300 mt-1 block">Listo ✅</span>
                </div>
              </div>

              {/* Progreso de la Sala en Vivo */}
              <div className="w-full bg-slate-900/90 border border-gold/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-gold" />
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-white font-[Cinzel] tracking-wide">
                        Progreso de los Hermanos en Vivo
                      </h3>
                      <p className="text-[11px] text-gray-400">
                        {quizProgress.finishedCount} de {quizProgress.totalParticipants || participants.length} participantes han finalizado
                      </p>
                    </div>
                  </div>

                  {quizProgress.allFinished ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-400 text-emerald-300 animate-pulse">
                      <CheckCheck className="w-4 h-4" />
                      <span>¡Todos Terminaron!</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-400 text-amber-300">
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      <span>Esperando ({Math.max(0, (quizProgress.totalParticipants || participants.length) - quizProgress.finishedCount)})</span>
                    </span>
                  )}
                </div>

                {/* Barra visual de progreso grupal */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-gradient-to-r from-gold to-emerald-400 transition-all duration-500"
                    style={{ width: `${quizProgress.totalParticipants > 0 ? (quizProgress.finishedCount / quizProgress.totalParticipants) * 100 : 0}%` }}
                  />
                </div>

                {/* Lista de Participantes: Listos vs En Progreso */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                  {/* Listos */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Listos ({quizProgress.finishedCount})</span>
                    </p>
                    {(quizProgress.participantsProgress || []).filter(p => p.isFinished).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200">
                        <span className="font-semibold truncate">{p.username}</span>
                        <span className="font-mono text-emerald-400 font-bold">{p.score} pts</span>
                      </div>
                    ))}
                  </div>

                  {/* En progreso */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>En Progreso ({(quizProgress.participantsProgress || []).filter(p => !p.isFinished).length})</span>
                    </p>
                    {(quizProgress.participantsProgress || []).filter(p => !p.isFinished).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-950/25 border border-amber-500/30 text-xs text-amber-200">
                        <span className="truncate">{p.username}</span>
                        <span className="text-[10px] text-amber-400 font-mono">Pregunta {p.completedCount + 1}/{activeQuestions.length} ⏳</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Panel del Líder para Mostrar Resultados */}
              {isHost ? (
                <div className="w-full bg-primary-dark/80 border-2 border-gold/50 rounded-2xl p-4 sm:p-5 text-center space-y-3 shadow-xl">
                  <h4 className="font-[Cinzel] text-sm sm:text-base font-bold text-gold">
                    👑 Control de Moderación del Líder
                  </h4>
                  <p className="text-xs text-gray-300 max-w-md mx-auto">
                    {quizProgress.allFinished 
                      ? '¡Gloria a Dios! Todos los participantes han contestado las preguntas. Ya puedes revelar el podio oficial y los resultados.'
                      : 'Puedes esperar a que todos concluyan o pulsar el botón para mostrar los resultados en este instante.'}
                  </p>
                  
                  <button
                    onClick={handleRevealQuizResults}
                    className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black text-sm shadow-xl transition-all cursor-pointer hover:scale-105 inline-flex items-center justify-center gap-2 ${
                      quizProgress.allFinished
                        ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-slate-900 ring-4 ring-emerald-400/50 animate-bounce'
                        : 'bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white'
                    }`}
                  >
                    <BarChart3 className="w-5 h-5" />
                    <span>
                      {quizProgress.allFinished 
                        ? '¡Revelar Resultados y Podio Final Ahora! 🏆' 
                        : `Mostrar Resultados (${quizProgress.finishedCount}/${quizProgress.totalParticipants || participants.length} Listos) 📊`}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="text-xs text-gray-400 italic text-center p-2 bg-white/5 rounded-xl border border-white/10 w-full max-w-md">
                  📖 El líder/administrador revelará los resultados finales y el podio para todos en cuanto concluyan los participantes.
                </div>
              )}

            </div>
          )
        )}

        {/* ---------------- FASE C: PODIO FINAL & RESULTADOS COMPLETOS (SALA PERMANECE ABIERTA) ---------------- */}
        {(phase === 'finished' || revealedResults) && (() => {
          const leaderboardList = (revealedResults?.leaderboard && revealedResults.leaderboard.length > 0)
            ? revealedResults.leaderboard
            : (finalPodium && finalPodium.length > 0)
            ? finalPodium
            : (liveLeaderboard && liveLeaderboard.length > 0)
            ? liveLeaderboard
            : participants;

          return (
            <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 max-w-4xl mx-auto w-full overflow-y-auto space-y-6 text-white animate-fadeIn pb-20">
              
              {/* Encabezado Celebratorio */}
              <div className="text-center space-y-2">
                <Trophy className="w-14 h-14 sm:w-16 sm:h-16 text-gold animate-bounce mx-auto" />
                <h2 className="font-[Cinzel] text-2xl sm:text-3xl font-bold text-gold">
                  ¡Gran Estudio y Quiz Finalizado!
                </h2>
                <p className="text-xs sm:text-sm text-gray-300 max-w-md mx-auto">
                  La gloria sea a Dios por su Palabra. Los Puntos de Sabiduría han sido acreditados a los participantes.
                </p>
              </div>

              {/* Estadísticas de Asistencia y Conectados */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-xl mx-auto">
                <div className="bg-slate-900/90 border border-gold/40 rounded-xl p-3 flex flex-col items-center shadow-lg text-center">
                  <Users className="w-4 h-4 text-gold mb-1" />
                  <span className="text-[10px] text-gray-400 uppercase font-bold">Asistencia al Meet</span>
                  <span className="text-base sm:text-lg font-black text-white font-mono">
                    {totalJoinedCount || participants.length}
                  </span>
                </div>
                <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-3 flex flex-col items-center shadow-lg text-center">
                  <Users className="w-4 h-4 text-emerald-400 mb-1" />
                  <span className="text-[10px] text-gray-400 uppercase font-bold">En Plataforma</span>
                  <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                    {platformOnlineCount}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-slate-900/90 border border-amber-500/40 rounded-xl p-3 flex flex-col items-center shadow-lg text-center">
                  <Award className="w-4 h-4 text-amber-400 mb-1" />
                  <span className="text-[10px] text-gray-400 uppercase font-bold">Tu Puntaje</span>
                  <span className="text-base sm:text-lg font-black text-amber-300 font-mono">
                    {mySessionScore || myAnswers.reduce((acc, a) => acc + (a?.points || 0), 0)} pts
                  </span>
                </div>
              </div>

              {/* PODIO OLÍMPICO VISUAL (Top 3) */}
              {leaderboardList.length > 0 && (
                <div className="bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950 border-2 border-gold/40 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
                  <div className="text-center mb-5">
                    <span className="text-[11px] uppercase tracking-widest font-black text-gold bg-gold/15 px-3 py-1 rounded-full border border-gold/30">
                      🏆 Podio de Honor
                    </span>
                  </div>

                  <div className="flex items-end justify-center gap-2 sm:gap-4 max-w-lg mx-auto pt-3 pb-2">
                    {/* 2º LUGAR (Plata - Izquierda) */}
                    {leaderboardList.length > 1 && leaderboardList[1] && (
                      <div className="flex-1 flex flex-col items-center">
                        <div className="relative mb-2">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-800 border-2 border-slate-300 flex items-center justify-center text-xl sm:text-2xl font-bold shadow-lg shadow-slate-400/20">
                            🥈
                          </div>
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-slate-200 truncate max-w-[90px] sm:max-w-[120px] text-center">
                          {leaderboardList[1].username}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-300">
                          {leaderboardList[1].score || 0} pts
                        </span>
                        {leaderboardList[1].correctCount !== undefined && (
                          <span className="text-[10px] text-gray-400">
                            {leaderboardList[1].correctCount}/{activeQuestions.length} aciertos
                          </span>
                        )}
                        <div className="w-full bg-gradient-to-t from-slate-800 to-slate-700/80 border-t-2 border-slate-300 rounded-t-xl h-20 sm:h-24 flex items-center justify-center mt-2 shadow-inner">
                          <span className="text-xl sm:text-2xl font-black text-slate-300">2º</span>
                        </div>
                      </div>
                    )}

                    {/* 1º LUGAR (Oro - Centro Elevado) */}
                    {leaderboardList[0] && (
                      <div className="flex-1 flex flex-col items-center z-10">
                        <div className="relative mb-2">
                          <Crown className="w-6 h-6 text-yellow-300 mx-auto -mb-1 filter drop-shadow animate-pulse" />
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 border-2 border-yellow-200 flex items-center justify-center text-2xl sm:text-3xl font-bold shadow-xl shadow-amber-500/30">
                            🥇
                          </div>
                        </div>
                        <span className="text-xs sm:text-sm font-black text-gold-light truncate max-w-[100px] sm:max-w-[130px] text-center">
                          {leaderboardList[0].username}
                        </span>
                        <span className="text-xs font-mono font-black text-yellow-300">
                          {leaderboardList[0].score || 0} pts
                        </span>
                        {leaderboardList[0].correctCount !== undefined && (
                          <span className="text-[10px] text-yellow-300/80 font-bold">
                            {leaderboardList[0].correctCount}/{activeQuestions.length} aciertos
                          </span>
                        )}
                        <div className="w-full bg-gradient-to-t from-amber-900/90 via-amber-800/90 to-yellow-600/80 border-t-2 border-yellow-300 rounded-t-xl h-28 sm:h-32 flex flex-col items-center justify-center mt-2 shadow-2xl ring-1 ring-yellow-400/50">
                          <span className="text-2xl sm:text-3xl font-black text-yellow-200">1º</span>
                          <span className="text-[9px] uppercase tracking-wider text-yellow-300 font-extrabold">Campeón</span>
                        </div>
                      </div>
                    )}

                    {/* 3º LUGAR (Bronce - Derecha) */}
                    {leaderboardList.length > 2 && leaderboardList[2] && (
                      <div className="flex-1 flex flex-col items-center">
                        <div className="relative mb-2">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-800 border-2 border-amber-600 flex items-center justify-center text-xl sm:text-2xl font-bold shadow-lg shadow-amber-700/20">
                            🥉
                          </div>
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-amber-300 truncate max-w-[90px] sm:max-w-[120px] text-center">
                          {leaderboardList[2].username}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-amber-400">
                          {leaderboardList[2].score || 0} pts
                        </span>
                        {leaderboardList[2].correctCount !== undefined && (
                          <span className="text-[10px] text-gray-400">
                            {leaderboardList[2].correctCount}/{activeQuestions.length} aciertos
                          </span>
                        )}
                        <div className="w-full bg-gradient-to-t from-amber-950 to-amber-900/80 border-t-2 border-amber-600 rounded-t-xl h-16 sm:h-18 flex items-center justify-center mt-2 shadow-inner">
                          <span className="text-xl sm:text-2xl font-black text-amber-500">3º</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pestañas de Resultados: Tabla de Posicionamiento, Recap de Respuestas, Estadísticas de la Sala y Tabla Global */}
              <div className="bg-slate-900 border border-gold/40 rounded-2xl overflow-hidden shadow-2xl">
                <div className="flex border-b border-gold/20 bg-slate-950/70 overflow-x-auto scrollbar-none">
                  <button
                    onClick={() => setActiveResultsTab('posiciones')}
                    className={`flex-1 min-w-[130px] py-3 px-3 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      activeResultsTab === 'posiciones' 
                        ? 'bg-gold/20 text-gold-light border-b-2 border-gold shadow-inner' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Trophy className="w-4 h-4 text-gold shrink-0" />
                    <span>Posicionamiento ({leaderboardList.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveResultsTab('revision')}
                    className={`flex-1 min-w-[140px] py-3 px-3 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      activeResultsTab === 'revision' 
                        ? 'bg-gold/20 text-gold-light border-b-2 border-gold shadow-inner' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Recap de Respuestas ({myCorrectCount}/{activeQuestions.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveResultsTab('estadisticas')}
                    className={`flex-1 min-w-[140px] py-3 px-3 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      activeResultsTab === 'estadisticas' 
                        ? 'bg-gold/20 text-gold-light border-b-2 border-gold shadow-inner' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Estadísticas de la Sala</span>
                  </button>
                  <button
                    onClick={() => setActiveResultsTab('global')}
                    className={`flex-1 min-w-[130px] py-3 px-3 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      activeResultsTab === 'global' 
                        ? 'bg-gold/20 text-gold-light border-b-2 border-gold shadow-inner' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Crown className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>Tabla de Honor Global</span>
                  </button>
                </div>

                <div className="p-3 sm:p-5">
                  {/* TAB 1: TABLA DE POSICIONAMIENTO COMPLETA */}
                  {activeResultsTab === 'posiciones' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-gray-400 px-2 py-1">
                        <span>Participantes clasificados por puntuación, aciertos y velocidad</span>
                        <span className="font-mono">{leaderboardList.length} en clasificación</span>
                      </div>

                      <div className="space-y-2">
                        {leaderboardList.map((p, idx) => {
                          const isMe = String(p.id) === String(user?.id);
                          const isConnected = p.connected !== false;
                          const correctCnt = p.correctCount !== undefined ? p.correctCount : 0;
                          const totalQs = p.totalQuestions || activeQuestions.length;
                          const accuracyPct = totalQs > 0 ? Math.round((correctCnt / totalQs) * 100) : 0;

                          return (
                            <div
                              key={p.id || idx}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-3.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all gap-2.5 ${
                                isMe 
                                  ? 'bg-gold/25 border-gold text-gold-light ring-1 ring-gold shadow-md' 
                                  : idx === 0 
                                  ? 'bg-amber-500/15 border-amber-400/60 text-amber-200' 
                                  : idx === 1 
                                  ? 'bg-slate-400/15 border-slate-300/60 text-slate-200' 
                                  : idx === 2 
                                  ? 'bg-amber-800/15 border-amber-700/60 text-amber-300' 
                                  : 'bg-white/5 border-white/10 text-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="font-black text-sm sm:text-base w-7 sm:w-8 shrink-0">
                                  {idx === 0 ? '🥇 1º' : idx === 1 ? '🥈 2º' : idx === 2 ? '🥉 3º' : `${idx + 1}º`}
                                </span>
                                
                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/20 flex items-center justify-center text-xs font-bold shrink-0 text-white shadow">
                                  {(p.username || 'P').charAt(0).toUpperCase()}
                                </div>

                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="truncate font-bold text-white">{p.username}</span>
                                    {isMe && (
                                      <span className="text-[10px] bg-gold/20 text-gold-light px-1.5 py-0.5 rounded border border-gold/40 font-bold shrink-0">
                                        (Tú)
                                      </span>
                                    )}
                                    {(p.isHost || ['admin', 'superadmin', 'lider', 'leader'].includes(p.role?.toLowerCase())) && (
                                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-400/30 font-bold shrink-0">
                                        Líder
                                      </span>
                                    )}
                                    <span 
                                      className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`}
                                      title={isConnected ? 'Conectado a la sala' : 'Desconectado'}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                                    <span>{correctCnt}/{totalQs} aciertos ({accuracyPct}%)</span>
                                    {p.avgTimeSec ? <span>• {p.avgTimeSec}s prom</span> : null}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                                <div className="text-left sm:text-right">
                                  <span className="font-mono font-black text-gold text-sm sm:text-base block">
                                    +{p.score || 0} pts
                                  </span>
                                  {p.totalPlatformPoints && (
                                    <span className="text-[10px] text-amber-300/80 font-mono block">
                                      🌟 {p.totalPlatformPoints} acum.
                                    </span>
                                  )}
                                </div>

                                <button
                                  onClick={() => {
                                    setSelectedUserForRecap(p.id);
                                    setActiveResultsTab('revision');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-gray-200 transition-all cursor-pointer whitespace-nowrap"
                                  title="Ver respuestas de este participante"
                                >
                                  Ver Recap 🔍
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: RECAP DE RESPUESTAS INFALIBLE */}
                  {activeResultsTab === 'revision' && (() => {
                    const targetUserId = selectedUserForRecap || (user?.id ? String(user.id) : null);
                    const targetUserAnswers = (targetUserId && revealedResults?.allUserAnswers?.[targetUserId])
                      ? revealedResults.allUserAnswers[targetUserId]
                      : myAnswers;

                    const targetParticipant = leaderboardList.find(p => String(p.id) === String(targetUserId));
                    const targetName = targetParticipant?.username || user?.username || 'Participante';
                    const targetIsMe = String(targetUserId) === String(user?.id);

                    const targetCorrectCount = activeQuestions.reduce((acc, q, idx) => {
                      const ans = targetUserAnswers[idx];
                      if (ans && ans.isCorrect) return acc + 1;
                      return acc;
                    }, 0);

                    const filteredQuestionsWithIdx = activeQuestions.map((q, idx) => ({ q, idx })).filter(({ q, idx }) => {
                      const ans = targetUserAnswers[idx];
                      if (recapFilter === 'aciertos') return ans && ans.isCorrect;
                      if (recapFilter === 'falladas') return !ans || !ans.isCorrect;
                      return true;
                    });

                    return (
                      <div className="space-y-4">
                        {/* Selector de Participante & Resumen */}
                        <div className="bg-slate-950/60 border border-white/10 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-gray-300">Recap de:</span>
                            {isHost && leaderboardList.length > 1 ? (
                              <select
                                value={targetUserId || ''}
                                onChange={(e) => setSelectedUserForRecap(e.target.value)}
                                className="bg-slate-800 border border-gold/40 text-gold-light font-bold text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gold cursor-pointer"
                              >
                                {leaderboardList.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.username} {String(p.id) === String(user?.id) ? '(Tú)' : ''} ({p.score || 0} pts)
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs font-bold text-gold bg-gold/15 px-2.5 py-1 rounded-md border border-gold/30">
                                {targetName} {targetIsMe ? '(Tus Respuestas)' : ''}
                              </span>
                            )}

                            <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 px-2 py-1 rounded-md">
                              {targetCorrectCount} de {activeQuestions.length} aciertos ({activeQuestions.length > 0 ? Math.round((targetCorrectCount / activeQuestions.length) * 100) : 0}%)
                            </span>
                          </div>

                          {/* Filtros rápidos: Todos / Aciertos / Falladas */}
                          <div className="flex items-center gap-1.5 bg-slate-900 border border-white/10 p-1 rounded-lg text-xs font-bold">
                            <button
                              onClick={() => setRecapFilter('todos')}
                              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                recapFilter === 'todos' ? 'bg-gold text-slate-900 shadow' : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              Todas ({activeQuestions.length})
                            </button>
                            <button
                              onClick={() => setRecapFilter('aciertos')}
                              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                recapFilter === 'aciertos' ? 'bg-emerald-500 text-slate-900 shadow' : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              Aciertos ({targetCorrectCount})
                            </button>
                            <button
                              onClick={() => setRecapFilter('falladas')}
                              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                recapFilter === 'falladas' ? 'bg-red-500 text-white shadow' : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              Falladas ({activeQuestions.length - targetCorrectCount})
                            </button>
                          </div>
                        </div>

                        {/* Lista de preguntas revisadas */}
                        {filteredQuestionsWithIdx.length === 0 ? (
                          <div className="p-8 text-center text-gray-400 text-xs">
                            No hay preguntas en esta categoría de filtro.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {filteredQuestionsWithIdx.map(({ q, idx: qIdx }) => {
                              const userAns = targetUserAnswers[qIdx];
                              const correctLetter = getQuestionCorrectLetter(q);

                              const isTimeout = userAns?.selectedAnswer === 'timeout' || userAns?.isTimeout;
                              const isRight = userAns && userAns.isCorrect && !isTimeout;
                              const hasAnswered = !!userAns;
                              const selectedKey = userAns?.selectedAnswer;

                              const qText = q.question_text || q.questionText || `Pregunta ${qIdx + 1}`;
                              const explanation = q.explanation;
                              const verseRef = q.verse_reference || q.verseReference;

                              return (
                                <div 
                                  key={q.id || qIdx}
                                  className={`p-4 sm:p-5 rounded-2xl border space-y-3 text-left transition-all shadow-md ${
                                    isRight 
                                      ? 'bg-emerald-950/25 border-emerald-500/50 shadow-emerald-950/20' 
                                      : isTimeout 
                                      ? 'bg-amber-950/25 border-amber-500/50 shadow-amber-950/20'
                                      : hasAnswered 
                                      ? 'bg-red-950/25 border-red-500/50 shadow-red-950/20' 
                                      : 'bg-slate-950/40 border-gray-700'
                                  }`}
                                >
                                  {/* Encabezado de la Pregunta */}
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gold font-mono font-black text-xs px-2 py-0.5 rounded bg-gold/15 border border-gold/30">
                                          #{qIdx + 1}
                                        </span>
                                        {verseRef && (
                                          <span className="text-xs text-amber-300 font-semibold italic">
                                            📖 {verseRef}
                                          </span>
                                        )}
                                      </div>
                                      <h4 className="text-xs sm:text-base font-bold text-white leading-snug">
                                        {qText}
                                      </h4>
                                    </div>

                                    <div className="shrink-0 text-right">
                                      {isRight ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-400/40">
                                          <CheckCircle className="w-4 h-4" />
                                          <span>+{userAns.points || 50} pts</span>
                                        </span>
                                      ) : isTimeout ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-400/40">
                                          <Clock className="w-4 h-4" />
                                          <span>0 pts (Tiempo)</span>
                                        </span>
                                      ) : hasAnswered ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-red-400 bg-red-500/20 px-2.5 py-1 rounded-lg border border-red-400/40">
                                          <XCircle className="w-4 h-4" />
                                          <span>0 pts</span>
                                        </span>
                                      ) : (
                                        <span className="text-gray-500 italic text-[11px] bg-white/5 px-2 py-1 rounded">
                                          No respondida (0 pts)
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Las 4 Opciones Bíblicas con Estado Visual */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    {['a', 'b', 'c', 'd'].map(optKey => {
                                      const text = q[`option_${optKey}`] || q[`option${optKey.toUpperCase()}`];
                                      if (!text) return null;
                                      
                                      const isCorrectOpt = optKey === correctLetter;
                                      const isUserSelected = selectedKey === optKey;

                                      let optStyle = 'bg-white/5 border-white/10 text-gray-300';
                                      let badgeLabel = null;

                                      if (isCorrectOpt) {
                                        optStyle = 'bg-emerald-900/40 border-emerald-400 text-emerald-100 font-bold ring-1 ring-emerald-400 shadow-sm';
                                        badgeLabel = isUserSelected ? '✓ Tu Acierto' : '✓ Correcta';
                                      } else if (isUserSelected && !isCorrectOpt) {
                                        optStyle = 'bg-red-900/40 border-red-500 text-red-200 line-through ring-1 ring-red-400';
                                        badgeLabel = '✗ Tu Selección';
                                      }

                                      return (
                                        <div 
                                          key={optKey} 
                                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${optStyle}`}
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className={`w-5 h-5 rounded flex items-center justify-center font-bold uppercase text-[10px] shrink-0 ${
                                              isCorrectOpt ? 'bg-emerald-500 text-slate-900' : isUserSelected ? 'bg-red-500 text-white' : 'bg-white/10 text-gray-300'
                                            }`}>
                                              {optKey}
                                            </span>
                                            <span className="truncate">{text}</span>
                                          </div>

                                          {badgeLabel && (
                                            <span className={`text-[10px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded shrink-0 ${
                                              isCorrectOpt ? 'bg-emerald-500/30 text-emerald-300' : 'bg-red-500/30 text-red-300'
                                            }`}>
                                              {badgeLabel}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Explicación Bíblica y Citas */}
                                  {explanation && (
                                    <div className="bg-slate-900/80 border border-gold/30 rounded-xl p-3 text-[11px] sm:text-xs text-gray-200 leading-relaxed space-y-1">
                                      <div className="flex items-center gap-1.5 text-gold font-bold">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>Explicación Bíblica:</span>
                                      </div>
                                      <p className="text-gray-300">{explanation}</p>
                                      {verseRef && (
                                        <p className="text-gold font-semibold italic text-[11px] pt-1">
                                          Fundamentado en: 📖 {verseRef}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* TAB 3: ESTADÍSTICAS DE LA SALA (RENDIMIENTO POR PREGUNTA) */}
                  {activeResultsTab === 'estadisticas' && (() => {
                    const statsList = (revealedResults?.questionsResults && revealedResults.questionsResults.length > 0)
                      ? revealedResults.questionsResults
                      : activeQuestions.map((q, idx) => {
                          const correctL = getQuestionCorrectLetter(q);
                          return {
                            ...q,
                            questionIndex: idx,
                            correctAnswer: correctL,
                            correctPercentage: 0,
                            correctCount: 0,
                            incorrectCount: 0,
                            totalAnswered: 0,
                            breakdown: { a: 0, b: 0, c: 0, d: 0, timeout: 0 }
                          };
                        });

                    const totalQs = statsList.length;
                    const avgAccuracy = totalQs > 0 
                      ? Math.round(statsList.reduce((acc, curr) => acc + (curr.correctPercentage || 0), 0) / totalQs) 
                      : 0;

                    const bestQuestion = [...statsList].sort((a, b) => (b.correctPercentage || 0) - (a.correctPercentage || 0))[0];
                    const hardestQuestion = [...statsList].sort((a, b) => (a.correctPercentage || 0) - (b.correctPercentage || 0))[0];

                    return (
                      <div className="space-y-4">
                        {/* KPI Cards de la Sala */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-slate-950/70 border border-blue-500/40 rounded-xl p-3 text-center">
                            <span className="text-[10px] text-gray-400 uppercase font-bold block">Acierto Promedio de la Sala</span>
                            <span className="text-xl sm:text-2xl font-black text-blue-400 font-mono">{avgAccuracy}%</span>
                          </div>
                          <div className="bg-slate-950/70 border border-emerald-500/40 rounded-xl p-3 text-center">
                            <span className="text-[10px] text-gray-400 uppercase font-bold block">Pregunta Más Acertada</span>
                            <span className="text-xs sm:text-sm font-bold text-emerald-300 truncate block mt-1">
                              #{((bestQuestion?.questionIndex ?? 0) + 1)} ({bestQuestion?.correctPercentage || 0}%)
                            </span>
                          </div>
                          <div className="bg-slate-950/70 border border-amber-500/40 rounded-xl p-3 text-center">
                            <span className="text-[10px] text-gray-400 uppercase font-bold block">Pregunta Más Desafiante</span>
                            <span className="text-xs sm:text-sm font-bold text-amber-300 truncate block mt-1">
                              #{((hardestQuestion?.questionIndex ?? 0) + 1)} ({hardestQuestion?.correctPercentage || 0}%)
                            </span>
                          </div>
                        </div>

                        {/* Tabla de Rendimiento por Pregunta */}
                        <div className="space-y-3">
                          {statsList.map((stat, sIdx) => {
                            const qNumber = (stat.questionIndex !== undefined ? stat.questionIndex : sIdx) + 1;
                            const correctL = stat.correctAnswer || getQuestionCorrectLetter(stat);
                            const qText = stat.question_text || stat.questionText || `Pregunta ${qNumber}`;
                            const correctPct = stat.correctPercentage || 0;
                            const breakdown = stat.breakdown || { a: 0, b: 0, c: 0, d: 0, timeout: 0 };
                            
                            const difficultyLabel = correctPct >= 70 
                              ? { text: 'Accesible', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30' } 
                              : correctPct >= 40 
                              ? { text: 'Intermedia', color: 'text-yellow-400 bg-yellow-950/40 border-yellow-500/30' } 
                              : { text: 'Desafiante', color: 'text-red-400 bg-red-950/40 border-red-500/30' };

                            return (
                              <div key={sIdx} className="bg-slate-950/50 border border-white/10 rounded-xl p-3.5 space-y-2.5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-gold font-mono font-bold text-xs bg-gold/15 px-2 py-0.5 rounded border border-gold/30">
                                      #{qNumber}
                                    </span>
                                    <h5 className="text-xs sm:text-sm font-bold text-white truncate">
                                      {qText}
                                    </h5>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${difficultyLabel.color}`}>
                                      {difficultyLabel.text}
                                    </span>
                                    <span className="text-xs font-mono font-bold text-gold">
                                      {correctPct}% acierto
                                    </span>
                                  </div>
                                </div>

                                {/* Barra visual de acierto */}
                                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className={`h-full transition-all ${correctPct >= 70 ? 'bg-emerald-400' : correctPct >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                    style={{ width: `${correctPct}%` }}
                                  />
                                </div>

                                {/* Distribución de votos A, B, C, D */}
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-300">
                                  <span className="text-gray-400 font-medium">Elecciones:</span>
                                  {['a', 'b', 'c', 'd'].map(opt => {
                                    const isCorrect = opt === correctL;
                                    const count = breakdown[opt] || 0;
                                    return (
                                      <span 
                                        key={opt}
                                        className={`px-2 py-0.5 rounded border font-mono ${
                                          isCorrect 
                                            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 font-bold' 
                                            : 'bg-white/5 border-white/10 text-gray-400'
                                        }`}
                                      >
                                        {opt.toUpperCase()}: {count} {isCorrect ? '★' : ''}
                                      </span>
                                    );
                                  })}
                                  {breakdown.timeout > 0 && (
                                    <span className="px-2 py-0.5 rounded border border-amber-500/40 bg-amber-950/40 text-amber-300 font-mono">
                                      ⏰ Tiempo: {breakdown.timeout}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* TAB 4: TABLA DE HONOR GLOBAL DE LA PLATAFORMA */}
                  {activeResultsTab === 'global' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-gray-400 px-2 py-1">
                        <span>Puntuación acumulada histórica de los miembros de Remanente Platform</span>
                        <Crown className="w-4 h-4 text-gold" />
                      </div>

                      {loadingGlobalLeaderboard ? (
                        <div className="p-8 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-gold" />
                          <span>Cargando Tabla de Honor Global...</span>
                        </div>
                      ) : globalLeaderboard.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-xs">
                          No se encontraron registros en la tabla global.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {globalLeaderboard.map((item, gIdx) => {
                            const isMe = String(item.id) === String(user?.id);
                            return (
                              <div
                                key={item.id || gIdx}
                                className={`flex items-center justify-between p-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                                  isMe 
                                    ? 'bg-gold/25 border-gold text-gold-light ring-1 ring-gold shadow-md' 
                                    : gIdx === 0 
                                    ? 'bg-amber-500/15 border-amber-400 text-amber-200' 
                                    : gIdx === 1 
                                    ? 'bg-slate-400/15 border-slate-300 text-slate-200' 
                                    : gIdx === 2 
                                    ? 'bg-amber-800/15 border-amber-700 text-amber-300' 
                                    : 'bg-white/5 border-white/10 text-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="font-black text-sm sm:text-base w-7 sm:w-8 shrink-0">
                                    {gIdx === 0 ? '🥇 1º' : gIdx === 1 ? '🥈 2º' : gIdx === 2 ? '🥉 3º' : `${gIdx + 1}º`}
                                  </span>

                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="truncate font-bold text-white">{item.username}</span>
                                      {isMe && (
                                        <span className="text-[10px] bg-gold/20 text-gold-light px-1.5 py-0.5 rounded border border-gold/40 font-bold shrink-0">
                                          (Tú)
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-gray-400">
                                      {item.quizzes_completed || 0} quizzes completados
                                      {item.current_streak > 0 ? ` • 🔥 ${item.current_streak} días` : ''}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="font-mono font-black text-gold text-sm sm:text-base block">
                                    {item.total_score || item.points || 0} pts
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>


              {/* Controles y Acciones Finales: La sala permanece abierta */}
              <div className="space-y-3 pt-2">
                {isHost && !sessionClosing && (
                  <div className="bg-slate-900/90 border border-gold/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shadow-lg">
                    <div className="space-y-0.5">
                      <h5 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 justify-center sm:justify-start">
                        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        <span>Reunión en Vivo y Activa</span>
                      </h5>
                      <p className="text-[11px] text-gray-400">
                        La reunión se mantiene abierta para todos. Puedes conversar y revisar las respuestas. Cuando desees terminar la reunión para todos, presiona el botón rojo.
                      </p>
                    </div>
                    <button
                      onClick={handleEndMeeting}
                      className="shrink-0 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-xl transition-all cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cerrar Reunión para Todos</span>
                    </button>
                  </div>
                )}

                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      if (socket) socket.disconnect();
                      navigate('/meet');
                    }}
                    className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-gray-200 border border-white/10 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Salir de la Sala (Individual)</span>
                  </button>
                </div>
              </div>

            </div>
          );
        })()}

      </div>

      {/* MODAL OVERLAY DE CIERRE AUTOMÁTICO DE REUNIÓN (SIN REFRESCAR) */}
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
              <h2 className="text-xl sm:text-2xl font-bold font-[Cinzel] text-white">
                Reunión Concluida
              </h2>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-sm mx-auto">
                {sessionClosing.message || 'El líder ha finalizado la sesión en vivo para todos los participantes.'}
              </p>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center gap-2">
              <span className="text-xs text-gray-400">Cerrando automáticamente en...</span>
              <span className="text-4xl font-black font-mono text-gold animate-bounce">
                {sessionClosing.countdown}
              </span>
              <span className="text-[11px] text-gray-500">segundos</span>
            </div>

            <button
              onClick={() => {
                if (socket) socket.disconnect();
                navigate('/meet', { replace: true });
              }}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-lg"
            >
              Salir Ahora
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE GESTIÓN / IMPORTACIÓN DE PREGUNTAS */}
      {isManageQuestionsOpen && (
        <ManageQuestionsModal
          isOpen={isManageQuestionsOpen}
          onClose={() => setIsManageQuestionsOpen(false)}
          meetId={id}
          initialQuestions={activeQuestions}
          onQuestionsSaved={(updatedQs) => {
            setMeet(prev => prev ? { ...prev, questions: updatedQs, questionsCount: updatedQs.length } : prev);
            setQuizQuestions(updatedQs);
            if (socket && socket.connected) {
              socket.emit('meet:update-questions', { meetId: id, questions: updatedQs });
            }
          }}
        />
      )}

    </div>
  );
};

export default MeetRoomPage;
