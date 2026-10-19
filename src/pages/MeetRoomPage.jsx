import { useState, useEffect, useRef, useMemo } from 'react';
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
  Filter,
  RotateCcw,
  X,
  Search
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
  const { user, isAdmin, isSuperAdmin } = useAuth();
  
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
  const [platformOnlineUsers, setPlatformOnlineUsers] = useState([]);
  const [sessionClosing, setSessionClosing] = useState(null); // { message, countdown: 4 }
  const [liveLeaderboard, setLiveLeaderboard] = useState([]);
  const [activeResultsTab, setActiveResultsTab] = useState('posiciones'); // 'posiciones' | 'revision' | 'estadisticas' | 'global'
  const [resultsViewMode, setResultsViewMode] = useState('results'); // 'results' | 'reading' (permite alternar lectura y resultados)
  const [recapFilter, setRecapFilter] = useState('todos'); // 'todos' | 'aciertos' | 'falladas'
  const [selectedUserForRecap, setSelectedUserForRecap] = useState(null); // null = current user
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [loadingGlobalLeaderboard, setLoadingGlobalLeaderboard] = useState(false);
  const [isManageQuestionsOpen, setIsManageQuestionsOpen] = useState(false);
  const [isRoomParticipantsModalOpen, setIsRoomParticipantsModalOpen] = useState(false);
  const [participantsModalTab, setParticipantsModalTab] = useState('room'); // 'room' | 'platform'
  const [isQuizProgressModalOpen, setIsQuizProgressModalOpen] = useState(false);
  const [roomPresenceUsers, setRoomPresenceUsers] = useState([]);
  const [resultsSearchQuery, setResultsSearchQuery] = useState('');

  const isHost = meet && (String(user?.id) === String(meet.host_id) || ['admin', 'superadmin', 'lider', 'leader'].includes(user?.role?.toLowerCase()));
  const isLeaderOrAdmin = Boolean(
    isHost ||
    isAdmin ||
    isSuperAdmin ||
    ['admin', 'superadmin', 'lider', 'leader'].includes(user?.role?.toLowerCase()) ||
    user?.username?.toLowerCase() === 'marcos'
  );
  const pdfContainerRef = useRef(null);
  const broadcastChannelRef = useRef(null);
  const roomPresenceChannelRef = useRef(null);
  const lastLaserSentRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const myAnswersRef = useRef(myAnswers);
  myAnswersRef.current = myAnswers;
  const myQuestionIndexRef = useRef(myQuestionIndex);
  myQuestionIndexRef.current = myQuestionIndex;

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
  const myCorrectCount = (Array.isArray(activeQuestions) ? activeQuestions : []).reduce((acc, q, idx) => {
    const ans = myAnswers?.[idx];
    if (ans && ans.isCorrect) return acc + 1;
    return acc;
  }, 0);

  // Sincronización infalible de participantes (Supabase Presence en Sala + Socket.io + Usuario Actual)
  const allRoomParticipants = useMemo(() => {
    const map = new Map();

    // 1. Incluir siempre al usuario actual
    if (user?.id || user?.username) {
      const myIdStr = String(user?.id || 'me');
      map.set(myIdStr, {
        id: myIdStr,
        userId: user?.id,
        username: user?.username || 'Yo',
        role: user?.role || 'user',
        isHost: Boolean(isHost),
        connected: true,
        score: mySessionScore || 0,
        isFinished: isSelfFinished,
        completedCount: Object.keys(myAnswers).length,
        lastSeen: Date.now()
      });
    }

    // 2. Fusionar los usuarios detectados en tiempo real por Supabase Presence en esta sala
    for (const p of roomPresenceUsers) {
      if (!p) continue;
      const pId = String(p.id || p.userId || p.username);
      const existing = map.get(pId);
      map.set(pId, {
        ...existing,
        id: pId,
        userId: p.userId || existing?.userId,
        username: p.username || existing?.username || 'Participante',
        role: p.role || existing?.role || 'user',
        isHost: p.isHost !== undefined ? p.isHost : existing?.isHost,
        connected: true,
        score: existing?.score || 0,
        isFinished: existing?.isFinished || false,
        completedCount: existing?.completedCount || 0,
        lastSeen: Date.now()
      });
    }

    // 3. Fusionar datos extendidos desde Socket.io (puntuaciones en vivo, manos levantadas, etc.)
    for (const s of participants) {
      if (!s) continue;
      const sId = String(s.id || s.userId || s.username);
      const existing = map.get(sId);
      map.set(sId, {
        ...existing,
        id: sId,
        userId: s.userId || existing?.userId,
        username: s.username || existing?.username || 'Participante',
        role: s.role || existing?.role || 'user',
        isHost: s.isHost !== undefined ? s.isHost : existing?.isHost,
        score: s.score !== undefined ? s.score : existing?.score || 0,
        handRaised: s.handRaised,
        isFinished: s.isFinished !== undefined ? s.isFinished : existing?.isFinished,
        completedCount: s.completedCount !== undefined ? s.completedCount : existing?.completedCount,
        // Si Supabase Presence confirma su presencia, se mantiene conectado aunque el socket parpadee
        connected: existing ? (existing.connected || s.connected !== false) : (s.connected !== false)
      });
    }

    // 3. Garantizar que el usuario local siempre esté presente con su estado actualizado
    if (user?.id) {
      const myId = String(user.id);
      const existing = map.get(myId);
      map.set(myId, {
        ...existing,
        id: myId,
        userId: user.id,
        username: user.username || 'Tú',
        role: user.role || 'user',
        isHost: Boolean(isHost),
        score: mySessionScore || existing?.score || 0,
        isFinished: isSelfFinished || existing?.isFinished,
        completedCount: Object.keys(myAnswers).length,
        connected: true
      });
    }

    return Array.from(map.values());
  }, [roomPresenceUsers, participants, user?.id, user?.username, user?.role, isHost, mySessionScore, isSelfFinished, myAnswers]);

  const connectedParticipants = allRoomParticipants.filter(p => p.connected !== false);
  const connectedCount = Math.max(1, connectedParticipants.length);
  const safeTotalParticipants = Math.max(connectedCount, allRoomParticipants.length, quizProgress.totalParticipants || 0, 1);

  // Lista unificada y reactiva de progreso de todos los participantes en el quiz
  const {
    unifiedQuizProgressList,
    readyParticipants,
    inProgressParticipants,
    effectiveFinishedCount,
    effectiveTotalParticipants
  } = useMemo(() => {
    const listMap = new Map();
    const totalQ = (quizQuestions && quizQuestions.length) || (meet?.questions && meet.questions.length) || 1;

    // 1. Agregar todos los participantes conectados/presentes en la sala
    allRoomParticipants.forEach(p => {
      if (!p) return;
      const pId = String(p.id || p.userId || p.username);
      const isMe = String(user?.id) === pId || p.username === user?.username;
      const myCompleted = Object.keys(myAnswers).length;
      const finished = isMe 
        ? (isSelfFinished || myCompleted >= totalQ)
        : Boolean(p.isFinished || (p.completedCount !== undefined && p.completedCount >= totalQ));

      listMap.set(pId, {
        id: pId,
        username: p.username || (isMe ? (user?.username || 'Tú') : 'Participante'),
        score: isMe ? Math.max(mySessionScore, p.score || 0) : (p.score || 0),
        completedCount: isMe ? myCompleted : (p.completedCount || 0),
        isFinished: finished,
        isMe,
        role: p.role,
        isHost: p.isHost
      });
    });

    // 2. Fusionar los datos emitidos por quizProgress.participantsProgress del servidor
    if (quizProgress?.participantsProgress && Array.isArray(quizProgress.participantsProgress)) {
      quizProgress.participantsProgress.forEach(sp => {
        if (!sp) return;
        const spId = String(sp.id || sp.userId || sp.username);
        const existing = listMap.get(spId);
        const isMe = String(user?.id) === spId || sp.username === user?.username;
        const finished = isMe ? (isSelfFinished || existing?.isFinished || sp.isFinished) : Boolean(sp.isFinished);
        const score = isMe ? Math.max(mySessionScore, sp.score || 0, existing?.score || 0) : (sp.score !== undefined ? sp.score : (existing?.score || 0));
        const completedCount = isMe ? Math.max(Object.keys(myAnswers).length, sp.completedCount || 0) : (sp.completedCount !== undefined ? sp.completedCount : (existing?.completedCount || 0));

        listMap.set(spId, {
          ...existing,
          id: spId,
          username: sp.username || existing?.username || 'Participante',
          score,
          completedCount,
          isFinished: finished || completedCount >= totalQ,
          isMe,
          role: existing?.role || 'user',
          isHost: existing?.isHost
        });
      });
    }

    // 3. Asegurar que el usuario actual siempre esté presente con su estado local más fresco
    if (user?.id) {
      const myId = String(user.id);
      const existing = listMap.get(myId);
      const myCompleted = Object.keys(myAnswers).length;
      listMap.set(myId, {
        ...existing,
        id: myId,
        username: user.username || 'Tú',
        score: Math.max(mySessionScore, existing?.score || 0),
        completedCount: Math.max(myCompleted, existing?.completedCount || 0),
        isFinished: isSelfFinished || myCompleted >= totalQ || Boolean(existing?.isFinished),
        isMe: true,
        role: user.role || 'user',
        isHost: Boolean(isHost)
      });
    }

    const all = Array.from(listMap.values());
    // Concursantes activos: excluir al anfitrión únicamente si solo modera y no ha respondido preguntas
    const activeContestants = all.filter(p => !(p.isHost && (p.completedCount || 0) === 0 && !p.isFinished));
    const ready = activeContestants.filter(p => p.isFinished);
    const inProgress = activeContestants.filter(p => !p.isFinished);
    const totalCount = Math.max(activeContestants.length, quizProgress?.totalParticipants || 0, 1);
    const finishedCount = ready.length;

    return {
      unifiedQuizProgressList: all,
      readyParticipants: ready,
      inProgressParticipants: inProgress,
      effectiveFinishedCount: finishedCount,
      effectiveTotalParticipants: totalCount
    };
  }, [allRoomParticipants, quizProgress, quizQuestions, meet?.questions, user?.id, user?.username, user?.role, myAnswers, isSelfFinished, mySessionScore, isHost, safeTotalParticipants]);

  useEffect(() => {
    loadMeetDetails();
  }, [id]);

  const loadMeetDetails = async () => {
    try {
      const data = await api.get(`/meetings/${id}`);
      if (data?.status === 'ended') {
        try {
          localStorage.removeItem(`meet_quiz_${id}_${user?.id}`);
          localStorage.removeItem(`remanente_meet_quiz_${id}_${user?.id}`);
          sessionStorage.removeItem(`meet_quiz_${id}_${user?.id}`);
        } catch (e) {}
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
      if (data?.phase) {
        setPhase(data.phase);
      }
      if (data?.revealedResults) {
        setRevealedResults(data.revealedResults);
        if (data.revealedResults.leaderboard) setLiveLeaderboard(data.revealedResults.leaderboard);
        if (data.revealedResults.podium) setFinalPodium(data.revealedResults.podium);
      }
      if (data?.quizProgress) {
        setQuizProgress(data.quizProgress);
        if (data.quizProgress.leaderboard) setLiveLeaderboard(data.quizProgress.leaderboard);
      }
      // Restauración de respuestas y puntaje si el usuario salió y volvió a entrar
      if (data?.myAnswers && Array.isArray(data.myAnswers) && data.myAnswers.length > 0) {
        setMyAnswers(prev => {
          const map = { ...prev };
          data.myAnswers.forEach(ans => {
            if (ans && ans.questionIndex !== undefined) {
              map[ans.questionIndex] = ans;
            }
          });
          return map;
        });
        const highestIdx = Math.max(...data.myAnswers.map(a => Number(a.questionIndex) || 0));
        setMyQuestionIndex(prev => Math.max(prev, Math.min(highestIdx + 1, (data.questions?.length || 1) - 1)));
      }
      if (data?.myScore !== undefined && data.myScore > 0) {
        setMySessionScore(prev => Math.max(prev, data.myScore));
      }
      if (data?.myIsFinished) {
        setIsSelfFinished(true);
      }
    } catch (err) {
      console.error('Error cargando meet:', err);
      alert('Error cargando la sala Meet.');
      navigate('/meet');
    } finally {
      setLoading(false);
    }
  };

  // Blindaje y recuperación inmediata local anti-recarga y anti-salida accidental (Anti-F5 / Anti-Rejoin)
  useEffect(() => {
    if (!id || !user?.id) return;
    const cacheKey = `meet_quiz_${id}_${user.id}`;
    const altCacheKey = `remanente_meet_quiz_${id}_${user.id}`;
    try {
      const cached = localStorage.getItem(cacheKey) || localStorage.getItem(altCacheKey) || sessionStorage.getItem(cacheKey);
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
        const serialized = JSON.stringify({
          answers: myAnswers,
          questionIndex: myQuestionIndex,
          isFinished: isSelfFinished,
          score: mySessionScore
        });
        localStorage.setItem(cacheKey, serialized);
        sessionStorage.setItem(cacheKey, serialized);
      } catch (e) {}
    }
  }, [myAnswers, myQuestionIndex, isSelfFinished, mySessionScore, id, user?.id]);

  // Limpieza automática total de datos locales al finalizar o cerrar la reunión
  useEffect(() => {
    if (sessionClosing || meet?.status === 'ended') {
      try {
        if (id && user?.id) {
          localStorage.removeItem(`meet_quiz_${id}_${user.id}`);
          localStorage.removeItem(`remanente_meet_quiz_${id}_${user.id}`);
          sessionStorage.removeItem(`meet_quiz_${id}_${user.id}`);
        }
      } catch (e) {}
    }
  }, [sessionClosing, meet?.status, id, user?.id]);

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
        setMyAnswers(prev => ({ ...answersMap, ...prev }));
        const answeredCount = Math.max(Object.keys(answersMap).length, Object.keys(myAnswersRef.current || {}).length);
        setMyQuestionIndex(prev => Math.max(prev, answeredCount));
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
      const prevPhase = phaseRef.current;
      setPhase(newPhase);
      if (pQuestions && Array.isArray(pQuestions) && pQuestions.length > 0) {
        setQuizQuestions(pQuestions);
      }
      if (newPhase === 'quiz') {
        const hasExistingAnswers = Object.keys(myAnswersRef.current || {}).length > 0;
        if (prevPhase !== 'quiz' && !hasExistingAnswers) {
          setIsSelfFinished(false);
          setCurrentFeedback(null);
          setRevealedResults(null);
          setMyQuestionIndex(0);
          setMyAnswers({});
          setResultsViewMode('results');
          playNotificationSound();
        }
      }
      if (newPhase === 'reading') {
        setResultsViewMode('reading');
      }
      // Nota: phase === 'finished' muestra resultados, podio y recap. NO cierra la sala.
    });

    // Evento de inicio del Quiz: cada persona recibe el set completo y empieza a responder a su ritmo
    s.on('meet:quiz-started', ({ questions: qList, totalQuestions, progress }) => {
      const prevPhase = phaseRef.current;
      setPhase('quiz');
      if (qList && qList.length > 0) setQuizQuestions(qList);
      const hasExistingAnswers = Object.keys(myAnswersRef.current || {}).length > 0;
      if (prevPhase !== 'quiz' && !hasExistingAnswers) {
        setMyQuestionIndex(0);
        setMyAnswers({});
        setIsSelfFinished(false);
        setCurrentFeedback(null);
        setRevealedResults(null);
        setTimeLeft(qList?.[0]?.time_limit_seconds || 25);
        playNotificationSound();
      }
      if (progress) {
        setQuizProgress(progress);
        if (progress.leaderboard) setLiveLeaderboard(progress.leaderboard);
      }
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
      try {
        if (id && user?.id) {
          localStorage.removeItem(`meet_quiz_${id}_${user.id}`);
          localStorage.removeItem(`remanente_meet_quiz_${id}_${user.id}`);
          sessionStorage.removeItem(`meet_quiz_${id}_${user.id}`);
        }
      } catch (e) {}
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
              if (meta.phase === 'quiz' && phaseRef.current === 'reading') {
                const hasExistingAnswers = Object.keys(myAnswersRef.current || {}).length > 0;
                setPhase('quiz');
                if (meta.questions && Array.isArray(meta.questions) && meta.questions.length > 0) {
                  setQuizQuestions(meta.questions);
                }
                if (!hasExistingAnswers) {
                  setMyQuestionIndex(0);
                  setMyAnswers({});
                  setIsSelfFinished(false);
                  setCurrentFeedback(null);
                  setRevealedResults(null);
                  setTimeLeft(meta.questions?.[0]?.time_limit_seconds || 25);
                  playNotificationSound();
                }
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
        const prevPhase = phaseRef.current;
        setPhase('quiz');
        if (payload?.questions && Array.isArray(payload.questions) && payload.questions.length > 0) {
          setQuizQuestions(payload.questions);
        }
        const hasExistingAnswers = Object.keys(myAnswersRef.current || {}).length > 0;
        if (prevPhase !== 'quiz' && !hasExistingAnswers) {
          setMyQuestionIndex(0);
          setMyAnswers({});
          setIsSelfFinished(false);
          setCurrentFeedback(null);
          setRevealedResults(null);
          setTimeLeft(payload?.questions?.[0]?.time_limit_seconds || 25);
          playNotificationSound();
        }
      })
      .on('broadcast', { event: 'meet:participant-progress' }, ({ payload }) => {
        if (!payload || !payload.userId) return;
        const pIdStr = String(payload.userId);
        setQuizProgress(prev => {
          const totalQ = payload.totalQuestions || prev?.totalQuestions || 0;
          const currentList = Array.isArray(prev?.participantsProgress) ? [...prev.participantsProgress] : [];
          const idx = currentList.findIndex(p => String(p.id) === pIdStr);
          const updated = {
            id: pIdStr,
            username: payload.username || 'Participante',
            score: payload.score || 0,
            completedCount: payload.completedCount || 0,
            isFinished: Boolean(payload.isFinished),
            totalQuestions: totalQ
          };
          if (idx >= 0) {
            currentList[idx] = { ...currentList[idx], ...updated };
          } else {
            currentList.push(updated);
          }
          const finishedCount = currentList.filter(p => p.isFinished).length;
          return {
            ...(prev || {}),
            meetId: id,
            totalQuestions: totalQ,
            totalParticipants: Math.max(currentList.length, prev?.totalParticipants || 0),
            finishedCount,
            allFinished: currentList.length > 0 && finishedCount >= currentList.length,
            participantsProgress: currentList
          };
        });
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

  // Canal Supabase Realtime de Presencia en Sala: Rastreo ininterrumpido de participantes en vivo
  useEffect(() => {
    if (!id) return;

    const currentUserId = user?.id ? String(user.id) : null;
    const presenceKey = currentUserId 
      ? `user_${currentUserId}` 
      : `guest_${Math.random().toString(36).substring(2, 9)}`;

    const roomPresence = supabase.channel(`meet_room_presence_${id}`, {
      config: {
        presence: {
          key: presenceKey,
        },
      },
    });

    roomPresenceChannelRef.current = roomPresence;

    const trackMe = async () => {
      try {
        await roomPresence.track({
          id: currentUserId || `guest_${presenceKey}`,
          userId: currentUserId,
          username: user?.username || 'Participante',
          role: user?.role || 'user',
          isHost: Boolean(isHost),
          avatar: user?.avatar || null,
          joinedAt: Date.now(),
          onlineAt: new Date().toISOString()
        });
      } catch (e) {}
    };

    const handleRoomPresenceSync = () => {
      try {
        const state = roomPresence.presenceState();
        const list = [];
        const seen = new Set();

        for (const k of Object.keys(state)) {
          const presences = state[k] || [];
          for (const p of presences) {
            if (!p) continue;
            const uId = String(p.id || p.userId || p.username || k);
            if (!seen.has(uId)) {
              seen.add(uId);
              list.push({
                id: uId,
                userId: p.userId,
                username: p.username || 'Participante',
                role: p.role || 'user',
                isHost: Boolean(p.isHost),
                connected: true,
                lastSeen: Date.now()
              });
            }
          }
        }
        setRoomPresenceUsers(list);
      } catch (err) {
        console.error('Error procesando presencia de sala:', err);
      }
    };

    roomPresence
      .on('presence', { event: 'sync' }, handleRoomPresenceSync)
      .on('presence', { event: 'join' }, handleRoomPresenceSync)
      .on('presence', { event: 'leave' }, handleRoomPresenceSync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await trackMe();
        }
      });

    // Anti-sleep móvil y reconexión inmediata
    const handleRecheckPresence = () => {
      trackMe();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleRecheckPresence();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleRecheckPresence);
    window.addEventListener('focus', handleRecheckPresence);

    const presenceInterval = setInterval(trackMe, 20000);

    return () => {
      clearInterval(presenceInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleRecheckPresence);
      window.removeEventListener('focus', handleRecheckPresence);
      try {
        roomPresence.untrack();
        supabase.removeChannel(roomPresence);
      } catch (e) {}
    };
  }, [id, user?.id, isHost]);

  // Sincronización continua de usuarios en línea en toda la plataforma
  useEffect(() => {
    const handlePlatformOnline = (e) => {
      if (e?.detail) {
        if (typeof e.detail.onlineCount === 'number') {
          setPlatformOnlineCount(Math.max(1, e.detail.onlineCount));
        }
        if (Array.isArray(e.detail.users) && e.detail.users.length > 0) {
          setPlatformOnlineUsers(e.detail.users);
        }
      }
    };
    window.addEventListener('platform-online-update', handlePlatformOnline);
    return () => {
      window.removeEventListener('platform-online-update', handlePlatformOnline);
    };
  }, []);

  // Heartbeat Polling de sincronización continua (cada 2.5s)
  useEffect(() => {
    if (!id || sessionClosing) return;

    const checkSync = async () => {
      try {
        const res = await api.get(`/meetings/${id}`, false);
        if (res && res.status === 'ended') {
          try {
            if (id && user?.id) {
              localStorage.removeItem(`meet_quiz_${id}_${user.id}`);
              localStorage.removeItem(`remanente_meet_quiz_${id}_${user.id}`);
              sessionStorage.removeItem(`meet_quiz_${id}_${user.id}`);
            }
          } catch (e) {}
          setSessionClosing(prev => prev || {
            message: 'La reunión ha sido finalizada por el líder.',
            countdown: 4
          });
          return;
        }

        // Sincronización continua de quizProgress
        if (res?.quizProgress) {
          setQuizProgress(res.quizProgress);
          if (res.quizProgress.leaderboard) setLiveLeaderboard(res.quizProgress.leaderboard);
        }

        // Restauración de respuestas y puntaje si el usuario no las tenía
        if (res?.myAnswers && Array.isArray(res.myAnswers) && res.myAnswers.length > 0 && Object.keys(myAnswersRef.current || {}).length === 0) {
          setMyAnswers(prev => {
            const map = { ...prev };
            res.myAnswers.forEach(ans => {
              if (ans && ans.questionIndex !== undefined) {
                map[ans.questionIndex] = ans;
              }
            });
            return map;
          });
          if (res.myScore !== undefined && res.myScore > 0) {
            setMySessionScore(prev => Math.max(prev, res.myScore));
          }
          if (res.myIsFinished) {
            setIsSelfFinished(true);
          }
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
          setResultsViewMode('results');
          setTimeLeft(res.questions?.[0]?.time_limit_seconds || 25);
          playNotificationSound();
        }

        // 1.1. Sincronización automática si el líder reanuda lectura
        if (res?.phase === 'reading' && phase !== 'reading') {
          setPhase('reading');
          setResultsViewMode('reading');
        }

        // 2. Sincronización automática si el líder reveló resultados
        if ((res?.phase === 'finished' || res?.revealedResults) && (!revealedResults || phase !== 'finished')) {
          const effectiveLdr = res.revealedResults?.leaderboard || res.quizProgress?.leaderboard || [];
          const effectivePod = res.revealedResults?.podium || res.quizProgress?.podium || effectiveLdr.slice(0, 3);
          const results = res.revealedResults || {
            leaderboard: effectiveLdr,
            podium: effectivePod,
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

    // Polling ligero optimizado cada 5s para no saturar con 15+ personas
    const interval = setInterval(checkSync, 5000);
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

    // Transmisión inmediata por Supabase Realtime broadcast para todos los participantes
    if (broadcastChannelRef.current) {
      const completedCount = myQuestionIndex + 1;
      const isFinished = completedCount >= activeQuestions.length;
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'meet:participant-progress',
        payload: {
          meetId: id,
          userId: String(user?.id),
          username: user?.username || 'Participante',
          completedCount,
          totalQuestions: activeQuestions.length,
          isFinished,
          score: mySessionScore
        }
      }).catch(() => {});
    }

    // 1. Envío WebSocket primario (0ms)
    if (socket && socket.connected) {
      socket.emit('meet:submit-answer', {
        meetId: id,
        questionIndex: myQuestionIndex,
        selectedAnswer: 'timeout',
        timeTakenMs: limitSec * 1000,
        user
      });
    } else {
      // 2. Respaldo HTTP infalible (solo si socket no está conectado)
      api.post(`/meetings/${id}/submit-answer`, {
        questionIndex: myQuestionIndex,
        selectedAnswer: 'timeout',
        timeTakenMs: limitSec * 1000
      }).catch(err => console.warn('[Meet] Respaldo HTTP submit timeout:', err));
    }

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

    // Transmisión inmediata por Supabase Realtime broadcast para todos los participantes
    if (broadcastChannelRef.current) {
      const completedCount = myQuestionIndex + 1;
      const isFinished = completedCount >= activeQuestions.length;
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'meet:participant-progress',
        payload: {
          meetId: id,
          userId: String(user?.id),
          username: user?.username || 'Participante',
          completedCount,
          totalQuestions: activeQuestions.length,
          isFinished,
          score: mySessionScore + points
        }
      }).catch(() => {});
    }

    // 1. Envío WebSocket primario (0ms)
    if (socket && socket.connected) {
      socket.emit('meet:submit-answer', {
        meetId: id,
        questionIndex: myQuestionIndex,
        selectedAnswer: optKey,
        timeTakenMs,
        user
      });
    } else {
      // 2. Respaldo HTTP infalible (solo si socket no está conectado)
      api.post(`/meetings/${id}/submit-answer`, {
        questionIndex: myQuestionIndex,
        selectedAnswer: optKey,
        timeTakenMs
      }).then(res => {
        if (res && res.points && res.points > 0) {
          setMySessionScore(prev => Math.max(prev, res.totalScore || prev));
        }
      }).catch(err => console.warn('[Meet] Respaldo HTTP submit-answer:', err));
    }

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

  // Movimiento del Puntero Láser (con throttling para soportar 15+ personas)
  const handlePointerCoords = (clientX, clientY) => {
    if (!isHost || !laserModeActive || !pdfContainerRef.current) return;
    const now = Date.now();
    if (now - lastLaserSentRef.current < 45) return; // ~22 fps máx, ahorra 80% de ancho de banda y evita cuellos de botella
    lastLaserSentRef.current = now;

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

    // 2. Transmisión Supabase Realtime Broadcast inmediata para todos los participantes
    if (broadcastChannelRef.current) {
      const immediatePayload = {
        meetId: id,
        phase: 'finished',
        leaderboard: quizProgress?.leaderboard || liveLeaderboard || [],
        podium: quizProgress?.podium || finalPodium || [],
        fullQuestions: activeQuestions || []
      };
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'meet:quiz-results-revealed',
        payload: immediatePayload
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

  // 4.1. LÍDER REANUDA LA LECTURA GUIADA PARA TODOS LOS PARTICIPANTES
  const handleResumeReadingForEveryone = async () => {
    if (!isHost) return;
    if (!confirm('¿Deseas regresar a la lectura del documento para todos los participantes? Los resultados del quiz se conservarán para revisarlos cuando lo deseen.')) return;

    if (socket && socket.connected) {
      socket.emit('meet:change-phase', { meetId: id, phase: 'reading' });
    }

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'meet:phase-changed',
        payload: { phase: 'reading', meetId: id }
      }).catch(() => {});
    }

    setPhase('reading');
    setResultsViewMode('reading');

    try {
      await api.put(`/meetings/${id}/phase`, { phase: 'reading' });
    } catch (e) {
      try {
        const { data: dbMeet } = await supabase.from('meetings').select('description').eq('id', id).single();
        let meta = {};
        try { meta = JSON.parse(dbMeet?.description || '{}'); } catch {}
        meta.phase = 'reading';
        await supabase.from('meetings').update({ description: JSON.stringify(meta) }).eq('id', id);
      } catch (err) {}
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
    <div className="flex flex-col h-[calc(100dvh-4.75rem)] sm:h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-6.75rem)] min-h-[440px] sm:min-h-[500px] w-full max-w-[99vw] 2xl:max-w-[1850px] mx-auto bg-slate-900 rounded-xl sm:rounded-2xl shadow-2xl border border-gold/40 overflow-hidden relative">
      
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
          <button
            type="button"
            onClick={() => {
              setParticipantsModalTab('room');
              setIsRoomParticipantsModalOpen(true);
            }}
            className="bg-white/10 hover:bg-white/20 text-gray-200 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border border-white/10 hover:border-gold/40 shadow-inner cursor-pointer transition-all hover:scale-105"
            title={isLeaderOrAdmin 
              ? "Haz clic para ver las personas conectadas en esta sala y en toda la plataforma"
              : "Haz clic para ver los participantes en esta sala"}
          >
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
          </button>

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

          {/* Botón de Progreso del Quiz en Vivo */}
          {phase === 'quiz' && (
            <button
              type="button"
              onClick={() => setIsQuizProgressModalOpen(true)}
              className="bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 border border-emerald-500/40 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 shadow-inner"
              title="Ver participantes listos y en progreso"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>{effectiveFinishedCount}/{effectiveTotalParticipants}</span>
              <span className="hidden sm:inline font-normal text-emerald-300">listos</span>
            </button>
          )}

          {/* Botón Maestro del Líder para Mostrar Resultados y Podio */}
          {isHost && phase === 'quiz' && !revealedResults && (
            <button
              onClick={handleRevealQuizResults}
              className={`inline-flex items-center gap-1 sm:gap-1.5 text-white px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-black shadow-lg transition-all cursor-pointer hover:scale-105 ${
                effectiveFinishedCount >= effectiveTotalParticipants 
                  ? 'bg-gradient-to-r from-emerald-500 to-green-500 animate-bounce ring-2 ring-emerald-300 text-slate-900' 
                  : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500'
              }`}
              title="Mostrar resultados y podio a todos los participantes"
            >
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">
                {effectiveFinishedCount >= effectiveTotalParticipants ? '¡Podio Listo!' : `Mostrar Resultados (${effectiveFinishedCount}/${effectiveTotalParticipants})`}
              </span>
              <span>📊</span>
            </button>
          )}

          {/* Botón para alternar entre ver resultados y volver a la lectura */}
          {(phase === 'finished' || revealedResults) && (
            <button
              onClick={() => setResultsViewMode(prev => prev === 'results' ? 'reading' : 'results')}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow cursor-pointer hover:scale-105 bg-gold/20 text-gold-light border-gold/40 hover:bg-gold/30"
              title={resultsViewMode === 'results' ? 'Regresar a la lectura del documento' : 'Ver resultados y podio del quiz'}
            >
              {resultsViewMode === 'results' ? (
                <>
                  <BookOpen className="w-3.5 h-3.5 text-gold-light" />
                  <span className="hidden sm:inline">Ver Lectura</span>
                  <span className="sm:hidden">Lectura</span>
                </>
              ) : (
                <>
                  <Trophy className="w-3.5 h-3.5 text-yellow-300" />
                  <span className="hidden sm:inline">Ver Resultados</span>
                  <span className="sm:hidden">Podio</span>
                </>
              )}
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
        {(phase === 'reading' || ((phase === 'finished' || revealedResults) && resultsViewMode === 'reading')) && (
          <div className="flex-1 flex flex-col min-h-0 relative">
            {/* Banner de aviso cuando se vuelve a la lectura tras los resultados */}
            {(phase === 'finished' || revealedResults) && (
              <div className="bg-gradient-to-r from-slate-900 via-amber-950/90 to-slate-900 border-b border-gold/40 px-3 sm:px-4 py-2 flex items-center justify-between text-xs text-gold-light shadow-md z-30 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Trophy className="w-4 h-4 text-gold shrink-0 animate-bounce" />
                  <span className="font-semibold truncate">
                    Modo Lectura • Resultados y podio del quiz disponibles
                  </span>
                </div>
                <button
                  onClick={() => setResultsViewMode('results')}
                  className="px-3 py-1 bg-gradient-to-r from-gold to-gold-dark text-slate-950 font-black text-xs rounded-lg shadow hover:scale-105 transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ml-2"
                >
                  <Trophy className="w-3.5 h-3.5 text-slate-950" />
                  <span>Ver Resultados 🏆</span>
                </button>
              </div>
            )}

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
              <div className="flex-1 w-full h-full flex flex-col justify-between p-2.5 sm:p-4 md:p-6 lg:p-8 max-w-7xl 2xl:max-w-[1750px] mx-auto overflow-y-auto overflow-x-hidden min-h-0 space-y-3 sm:space-y-4 md:space-y-5 animate-fadeIn">
                
                {/* 1. Barra Superior: Progreso Personal, Contador, Temporizador y Puntos */}
                <div className="shrink-0 w-full bg-slate-900/90 border border-gold/40 p-2.5 sm:p-3.5 md:p-4 rounded-xl sm:rounded-2xl flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 text-white shadow-xl backdrop-blur-md">
                  <div className="min-w-0 flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="text-[10px] sm:text-xs font-black text-gold uppercase tracking-wider bg-gold/15 px-2.5 py-1 rounded-full border border-gold/30 shrink-0">
                      Pregunta {myQuestionIndex + 1} de {activeQuestions.length}
                    </span>
                    <span className="text-[10px] sm:text-xs text-gray-300 font-semibold hidden xs:inline">
                      • {effectiveFinishedCount} de {effectiveTotalParticipants} listos
                    </span>
                    {/* Barra de progreso de preguntas respondidas */}
                    <div className="w-24 xs:w-36 sm:w-48 md:w-64 bg-white/10 rounded-full h-2 overflow-hidden border border-white/10 shrink-0">
                      <div 
                        className="bg-gradient-to-r from-amber-500 to-gold h-full transition-all duration-300 shadow-sm"
                        style={{ width: `${activeQuestions.length > 0 ? ((myQuestionIndex) / activeQuestions.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
                    <div className="bg-white/10 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl border border-white/15 text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1.5 shadow-inner">
                      <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold shrink-0" />
                      <span className="whitespace-nowrap">Mis Puntos: <strong className="text-white font-mono">{mySessionScore}</strong></span>
                    </div>

                    {!currentFeedback && (
                      <div className={`flex items-center gap-1.5 px-3 sm:px-4 py-1 sm:py-1.5 rounded-xl font-mono text-xs sm:text-sm md:text-base font-black shrink-0 transition-all ${
                        timeLeft <= 5 
                          ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400 shadow-lg shadow-red-600/40' 
                          : 'bg-gold/20 text-gold-light border border-gold/40'
                      }`}>
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span>{timeLeft}s</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Banner de Supervisión para el Líder si está respondiendo */}
                {isHost && (
                  <div className="shrink-0 w-full bg-blue-950/60 border border-blue-500/40 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs text-blue-200 shadow-md">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-gold shrink-0">👑 Panel Líder:</span>
                      <span className="truncate">{effectiveFinishedCount} de {effectiveTotalParticipants} completaron todas las preguntas.</span>
                    </div>
                    <button
                      onClick={handleRevealQuizResults}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-lg text-xs transition-all cursor-pointer shadow-md hover:scale-105 shrink-0 ml-auto"
                    >
                      Mostrar Resultados 📊
                    </button>
                  </div>
                )}

                {/* 2. Tarjeta Principal de la Pregunta (Ocupa el ancho completo con tipografía responsive) */}
                <div className="w-full flex-1 min-h-[110px] sm:min-h-[140px] md:min-h-[180px] lg:min-h-[220px] max-h-[38vh] bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950 border-2 border-gold/60 p-4 sm:p-6 md:p-8 lg:p-10 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute top-0 right-0 w-48 h-48 bg-gold/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-wrap justify-center">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gold bg-gold/15 px-3 py-1 rounded-full border border-gold/30 shadow-sm inline-flex items-center gap-1.5">
                      📖 Palabra de Dios • Pregunta #{myQuestionIndex + 1}
                    </span>
                    {(currentQuestion.verse_reference || currentQuestion.verseReference) && (
                      <span className="text-[10px] sm:text-xs text-amber-300/90 font-mono hidden sm:inline-flex items-center gap-1 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                        ✨ {currentQuestion.verse_reference || currentQuestion.verseReference}
                      </span>
                    )}
                  </div>

                  <h2 className="font-[Cinzel] text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-white leading-snug sm:leading-relaxed max-w-5xl mx-auto px-2 select-text">
                    {currentQuestion.question_text || currentQuestion.questionText}
                  </h2>
                </div>

                {/* Barra Visual del Cronómetro (Largo completo) */}
                {!currentFeedback && (
                  <div className="shrink-0 w-full bg-slate-900 rounded-full h-2 sm:h-2.5 overflow-hidden border border-white/10 shadow-inner">
                    <div 
                      className={`h-full transition-all duration-1000 ease-linear ${
                        timeLeft <= 5 ? 'bg-red-500 animate-pulse shadow-[0_0_12px_#ef4444]' : 'bg-gradient-to-r from-gold via-yellow-400 to-amber-500'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, (timeLeft / (currentQuestion.time_limit_seconds || 25)) * 100))}%` }}
                    />
                  </div>
                )}

                {/* 3. Las 4 Opciones Interactivas (A, B, C, D) en cuadrícula responsive que abarca toda la pantalla */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 md:gap-4 lg:gap-5 w-full flex-1">
                  {['a', 'b', 'c', 'd'].map(optKey => {
                    const optText = currentQuestion[`option_${optKey}`] || currentQuestion[`option${optKey.toUpperCase()}`];
                    if (!optText) return null;

                    const isSelected = currentFeedback?.selectedAnswer === optKey;
                    const isCorrect = currentFeedback && currentFeedback.correctAnswer === optKey;
                    const isWrongSelected = currentFeedback && isSelected && !isCorrect;

                    // Colores temáticos elegantes para cada opción
                    const letterBadgeStyles = {
                      a: 'bg-red-500/20 border-red-500/40 text-red-300 group-hover:bg-red-500 group-hover:text-white',
                      b: 'bg-blue-500/20 border-blue-500/40 text-blue-300 group-hover:bg-blue-500 group-hover:text-white',
                      c: 'bg-amber-500/20 border-amber-500/40 text-yellow-300 group-hover:bg-amber-500 group-hover:text-slate-950',
                      d: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 group-hover:bg-emerald-500 group-hover:text-slate-950'
                    };

                    let btnStyle = 'bg-slate-900/90 hover:bg-slate-800/95 border-white/15 hover:border-gold/60 text-gray-100 hover:shadow-xl hover:shadow-gold/5';
                    let badgeStyle = letterBadgeStyles[optKey] || 'bg-white/10 text-white';

                    if (isCorrect) {
                      btnStyle = 'bg-emerald-950/80 border-emerald-400 text-emerald-100 ring-2 ring-emerald-400 shadow-xl shadow-emerald-500/20 font-bold';
                      badgeStyle = 'bg-emerald-400 text-slate-950 font-black';
                    } else if (isWrongSelected) {
                      btnStyle = 'bg-red-950/80 border-red-500 text-red-100 ring-2 ring-red-500 shadow-xl shadow-red-500/20';
                      badgeStyle = 'bg-red-500 text-white font-black';
                    } else if (isSelected) {
                      btnStyle = 'bg-gold/20 border-gold text-gold-light ring-2 ring-gold';
                      badgeStyle = 'bg-gold text-slate-950 font-black';
                    }

                    return (
                      <button
                        key={optKey}
                        disabled={!!currentFeedback}
                        onClick={() => handleAnswerSelect(optKey)}
                        className={`group w-full h-full min-h-[56px] sm:min-h-[70px] md:min-h-[82px] lg:min-h-[96px] xl:min-h-[105px] p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl border-2 text-left flex items-center justify-between gap-3 sm:gap-4 transition-all cursor-pointer disabled:cursor-default touch-manipulation select-none active:scale-[0.98] shadow-md ${btnStyle}`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3.5 md:gap-4 min-w-0">
                          <span className={`w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center font-black text-xs sm:text-base md:text-lg uppercase shrink-0 border transition-all ${badgeStyle}`}>
                            {optKey}
                          </span>
                          <span className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold leading-snug line-clamp-3 sm:line-clamp-none">
                            {optText}
                          </span>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5 ml-2">
                          {isCorrect && <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-emerald-400 animate-bounce" />}
                          {isWrongSelected && <XCircle className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-red-400 animate-pulse" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 4. Feedback Inmediato y Botón de Avance a Pantalla Completa */}
                {currentFeedback && (
                  <div className="shrink-0 w-full bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border-2 border-gold/50 p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl animate-fadeIn">
                    <div className="flex items-center gap-3 text-xs sm:text-sm md:text-base min-w-0">
                      {currentFeedback.isTimeout ? (
                        <div className="flex items-center gap-2 text-amber-400 font-bold">
                          <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-red-400 animate-pulse shrink-0" />
                          <span>⏰ ¡Tiempo agotado! (0 pts) • La opción correcta era la <strong>({currentFeedback.correctAnswer?.toUpperCase()})</strong></span>
                        </div>
                      ) : currentFeedback.isCorrect ? (
                        <div className="flex items-center gap-2 text-emerald-400 font-bold">
                          <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 shrink-0" />
                          <span>¡Respuesta Correcta! +{currentFeedback.points} pts</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-400 font-bold">
                          <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400 shrink-0" />
                          <span>Respuesta incorrecta. La opción correcta era la <strong>({currentFeedback.correctAnswer?.toUpperCase()})</strong></span>
                        </div>
                      )}
                      {(currentFeedback.verseReference || currentQuestion.verse_reference) && (
                        <span className="text-gold font-semibold italic text-xs md:text-sm hidden md:inline ml-2 pl-3 border-l border-white/15">
                          📖 {currentFeedback.verseReference || currentQuestion.verse_reference}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={handleGoToNextQuestion}
                      className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 bg-gradient-to-r from-gold via-yellow-400 to-amber-500 hover:from-yellow-400 hover:to-gold text-slate-950 font-black rounded-xl sm:rounded-2xl text-xs sm:text-sm md:text-base shadow-xl shadow-amber-500/30 transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0 flex items-center justify-center gap-2"
                    >
                      <span>
                        {myQuestionIndex + 1 < activeQuestions.length ? 'Siguiente Pregunta ➡️' : 'Finalizar Cuestionario ✅'}
                      </span>
                    </button>
                  </div>
                )}

                {/* 5. Barra Inferior de Progreso de la Sala */}
                <div className="shrink-0 w-full bg-slate-900/60 border border-white/10 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 text-[11px] sm:text-xs text-gray-300 flex items-center justify-between gap-2 shadow-inner">
                  <div className="flex items-center gap-2 truncate">
                    <Users className="w-3.5 h-3.5 text-gold shrink-0" />
                    <span className="truncate">Progreso de la sala: {effectiveFinishedCount} de {effectiveTotalParticipants} completaron</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsQuizProgressModalOpen(true)}
                    className="text-gold hover:text-white font-mono text-[11px] sm:text-xs font-bold underline cursor-pointer transition-colors shrink-0 whitespace-nowrap ml-2"
                  >
                    {effectiveFinishedCount >= effectiveTotalParticipants ? '¡Todos listos! Ver lista' : 'Ver quiénes están listos 🔍'}
                  </button>
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
            <div className="flex-1 flex flex-col justify-center items-center p-3 sm:p-6 md:p-8 max-w-5xl 2xl:max-w-6xl mx-auto w-full overflow-y-auto space-y-4 sm:space-y-6 animate-fadeIn">
              
              {/* Encabezado Celebratorio */}
              <div className="text-center space-y-2">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-gold/20 border-2 border-gold flex items-center justify-center text-gold shadow-lg shadow-gold/20 animate-pulse">
                  <Hourglass className="w-8 h-8 sm:w-10 sm:h-10 text-gold" />
                </div>
                <h2 className="font-[Cinzel] text-xl sm:text-2xl md:text-3xl font-bold text-gold">
                  ¡Has completado todas las preguntas bíblicas!
                </h2>
                <p className="text-xs sm:text-sm text-gray-300 max-w-lg mx-auto">
                  Excelente trabajo escudriñando las Escrituras. Ahora estamos esperando a que los demás hermanos terminen para revelar los resultados finales y el podio.
                </p>
              </div>

              {/* Tarjeta de Resumen Personal */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-4 w-full max-w-2xl">
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
                        {effectiveFinishedCount} de {effectiveTotalParticipants} participantes han finalizado
                      </p>
                    </div>
                  </div>

                  {effectiveFinishedCount >= effectiveTotalParticipants ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-400 text-emerald-300 animate-pulse">
                      <CheckCheck className="w-4 h-4" />
                      <span>¡Todos Terminaron!</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-400 text-amber-300">
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      <span>Esperando ({Math.max(0, effectiveTotalParticipants - effectiveFinishedCount)})</span>
                    </span>
                  )}
                </div>

                {/* Barra visual de progreso grupal */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-gradient-to-r from-gold to-emerald-400 transition-all duration-500"
                    style={{ width: `${effectiveTotalParticipants > 0 ? (effectiveFinishedCount / effectiveTotalParticipants) * 100 : 0}%` }}
                  />
                </div>

                {/* Lista de Participantes: Listos vs En Progreso */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                  {/* Listos */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Listos ({readyParticipants.length})</span>
                      </span>
                      <span className="text-[10px] text-emerald-300/80 font-normal">Concluyeron</span>
                    </p>
                    {readyParticipants.length === 0 ? (
                      <p className="text-[11px] text-gray-500 italic p-2 rounded bg-slate-950/40 border border-white/5">
                        Esperando que concluyan...
                      </p>
                    ) : (
                      readyParticipants.map(p => (
                        <div key={p.id} className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                          p.isMe 
                            ? 'bg-emerald-900/40 border-emerald-400/50 text-emerald-100 ring-1 ring-emerald-400/40' 
                            : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                        }`}>
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-semibold truncate">{p.username}</span>
                            {p.isMe && <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1 rounded font-bold">(Tú)</span>}
                          </div>
                          <span className="font-mono text-emerald-400 font-bold ml-2 shrink-0">{p.score} pts</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* En progreso */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>En Progreso ({inProgressParticipants.length})</span>
                      </span>
                      <span className="text-[10px] text-amber-300/80 font-normal">Respondiendo</span>
                    </p>
                    {inProgressParticipants.length === 0 ? (
                      <p className="text-[11px] text-gray-500 italic p-2 rounded bg-slate-950/40 border border-white/5">
                        Ningún hermano en progreso
                      </p>
                    ) : (
                      inProgressParticipants.map(p => (
                        <div key={p.id} className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                          p.isMe 
                            ? 'bg-amber-900/30 border-amber-400/50 text-amber-100 ring-1 ring-amber-400/40' 
                            : 'bg-amber-950/25 border-amber-500/30 text-amber-200'
                        }`}>
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate">{p.username}</span>
                            {p.isMe && <span className="text-[9px] bg-amber-500/30 text-amber-300 px-1 rounded font-bold">(Tú)</span>}
                          </div>
                          <span className="text-[10px] text-amber-400 font-mono ml-2 shrink-0">
                            Pregunta {Math.min(activeQuestions.length, (p.completedCount || 0) + 1)}/{activeQuestions.length} ⏳
                          </span>
                        </div>
                      ))
                    )}
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
                    {effectiveFinishedCount >= effectiveTotalParticipants 
                      ? '¡Gloria a Dios! Todos los participantes han contestado las preguntas. Ya puedes revelar el podio oficial y los resultados.'
                      : 'Puedes esperar a que todos concluyan o pulsar el botón para mostrar los resultados en este instante.'}
                  </p>
                  
                  <button
                    onClick={handleRevealQuizResults}
                    className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black text-sm shadow-xl transition-all cursor-pointer hover:scale-105 inline-flex items-center justify-center gap-2 ${
                      effectiveFinishedCount >= effectiveTotalParticipants
                        ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-slate-900 ring-4 ring-emerald-400/50 animate-bounce'
                        : 'bg-gradient-to-r from-gold to-gold-dark hover:from-gold-dark hover:to-gold text-white'
                    }`}
                  >
                    <BarChart3 className="w-5 h-5" />
                    <span>
                      {effectiveFinishedCount >= effectiveTotalParticipants 
                        ? '¡Revelar Resultados y Podio Final Ahora! 🏆' 
                        : `Mostrar Resultados (${effectiveFinishedCount}/${effectiveTotalParticipants} Listos) 📊`}
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
        {(phase === 'finished' || revealedResults) && resultsViewMode === 'results' && (() => {
          // 1. Obtener la tabla de posiciones autoritativa emitida por el servidor (Single Source of Truth)
          const authoritativeLeaderboard = (revealedResults?.leaderboard && Array.isArray(revealedResults.leaderboard) && revealedResults.leaderboard.length > 0)
            ? revealedResults.leaderboard
            : (liveLeaderboard && Array.isArray(liveLeaderboard) && liveLeaderboard.length > 0)
            ? liveLeaderboard
            : (quizProgress?.leaderboard && Array.isArray(quizProgress.leaderboard) && quizProgress.leaderboard.length > 0)
            ? quizProgress.leaderboard
            : (finalPodium && Array.isArray(finalPodium) && finalPodium.length > 0)
            ? finalPodium
            : allRoomParticipants;

          // Normalizar elementos asegurando id, username, score y rank exactos emitidos por el servidor
          const leaderboardList = [...(Array.isArray(authoritativeLeaderboard) ? authoritativeLeaderboard : [])]
            .filter(p => p && (p.username || p.name || p.id || p.userId))
            .map((p, idx) => ({
              ...p,
              id: String(p.id || p.userId || p.username),
              username: p.username || p.name || 'Participante',
              score: Number(p.score) || 0,
              correctCount: Number(p.correctCount) || 0,
              rank: p.rank || (idx + 1),
              hasParticipated: p.hasParticipated !== undefined 
                ? p.hasParticipated 
                : ((Number(p.score) || 0) > 0 || (Number(p.completedCount) || 0) > 0)
            }));

          // 2. Podio oficial: ÚNICAMENTE participantes reales que respondieron preguntas o sumaron puntos
          const rawPodium = (revealedResults?.podium && Array.isArray(revealedResults.podium) && revealedResults.podium.length > 0)
            ? revealedResults.podium
            : (quizProgress?.podium && Array.isArray(quizProgress.podium) && quizProgress.podium.length > 0)
            ? quizProgress.podium
            : (finalPodium && Array.isArray(finalPodium) && finalPodium.length > 0)
            ? finalPodium
            : leaderboardList.filter(p => p.hasParticipated);

          const podiumList = rawPodium
            .filter(p => p && (p.hasParticipated || (Number(p.score) || 0) > 0 || (Number(p.completedCount) || 0) > 0))
            .slice(0, 3)
            .map((p, idx) => ({
              ...p,
              id: String(p.id || p.userId || p.username),
              username: p.username || p.name || 'Participante',
              score: Number(p.score) || 0,
              correctCount: Number(p.correctCount) || 0,
              rank: idx + 1
            }));

          const totalQuestionsCount = (activeQuestions && activeQuestions.length > 0) 
            ? activeQuestions.length 
            : (revealedResults?.totalQuestions || 15);

          return (
            <div className="flex-1 flex flex-col p-2.5 sm:p-4 md:p-6 w-full overflow-y-auto space-y-4 sm:space-y-6 text-white animate-fadeIn pb-28">

              {/* 1. HERO BANNER SUPERIOR CON TROFEO Y MÉTRICAS (UBICACIÓN HORIZONTAL Y RESPONSIVE) */}
              <div className="shrink-0 w-full bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-slate-950 border border-gold/40 rounded-2xl p-3.5 sm:p-4 md:p-5 shadow-2xl backdrop-blur-md flex flex-col lg:flex-row items-center justify-between gap-4">
                
                {/* Lado Izquierdo: Icono Trofeo + Título del Estudio */}
                <div className="flex items-center gap-3.5 w-full lg:w-auto justify-center lg:justify-start">
                  <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-400 border-2 border-yellow-200/70 flex items-center justify-center text-2xl sm:text-3xl shrink-0 shadow-lg shadow-amber-500/25">
                    🏆
                  </div>
                  <div className="text-center lg:text-left min-w-0">
                    <div className="flex items-center justify-center lg:justify-start gap-2">
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-gold bg-gold/15 px-2.5 py-0.5 rounded-full border border-gold/30">
                        Resultados Oficiales
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                        {totalQuestionsCount} Preguntas
                      </span>
                    </div>
                    <h2 className="font-[Cinzel] text-base sm:text-xl font-bold text-white truncate max-w-xs sm:max-w-md mt-0.5">
                      {meet?.title || 'Estudio Bíblico y Quiz'}
                    </h2>
                    <p className="text-[11px] text-gray-400 hidden sm:block">
                      La gloria sea a Dios por su Palabra • Puntos de Sabiduría acreditados
                    </p>
                  </div>
                </div>

                {/* Lado Derecho: Las 3 Métricas de la Imagen (Asistencia, Plataforma, Tu Puntaje) + Botón Rápido */}
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 w-full lg:w-auto">
                  {/* Asistencia al Meet */}
                  <div 
                    onClick={() => { setParticipantsModalTab('room'); setIsRoomParticipantsModalOpen(true); }}
                    className="bg-slate-950/80 hover:bg-slate-900 border border-gold/30 hover:border-gold rounded-xl px-3 py-2 flex items-center gap-2.5 shadow cursor-pointer transition-all hover:scale-105"
                    title="Clic para ver detalles de los participantes en sala"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gold/15 flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5 text-gold" />
                    </div>
                    <div className="text-left leading-none">
                      <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold block mb-1">Asistencia</span>
                      <span className="text-xs sm:text-sm font-black text-white font-mono">
                        {Math.max(totalJoinedCount || 0, connectedCount, allRoomParticipants.length)}
                      </span>
                    </div>
                  </div>

                  {/* En Plataforma */}
                  {isLeaderOrAdmin ? (
                    <div 
                      onClick={() => { setParticipantsModalTab('platform'); setIsRoomParticipantsModalOpen(true); }}
                      className="bg-slate-950/80 hover:bg-slate-900 border border-emerald-500/30 hover:border-emerald-400 rounded-xl px-3 py-2 flex items-center gap-2.5 shadow cursor-pointer transition-all hover:scale-105"
                      title="Clic para ver personas en línea en la plataforma (Líderes/Admin)"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="text-left leading-none">
                        <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold block mb-1">Plataforma</span>
                        <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono">
                          {platformOnlineCount}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="bg-slate-950/80 border border-emerald-500/30 rounded-xl px-3 py-2 flex items-center gap-2.5 shadow select-none"
                      title={`${platformOnlineCount} personas en línea en la plataforma`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="text-left leading-none">
                        <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold block mb-1">Plataforma</span>
                        <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono">
                          {platformOnlineCount}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Tu Puntaje */}
                  <div className="bg-gradient-to-r from-amber-950/60 to-slate-950 border border-amber-500/40 rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                      <Award className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-left leading-none">
                      <span className="text-[9px] uppercase tracking-wider text-amber-300/80 font-bold block mb-1">Tu Puntaje</span>
                      <span className="text-xs sm:text-sm font-black text-amber-300 font-mono">
                        {(mySessionScore !== undefined && mySessionScore !== null) ? mySessionScore : Object.values(myAnswers || {}).reduce((acc, a) => acc + (Number(a?.points) || 0), 0)} pts
                      </span>
                    </div>
                  </div>

                  {/* Botón Volver a la Lectura */}
                  <button
                    onClick={() => setResultsViewMode('reading')}
                    className="bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/40 text-blue-200 hover:text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-all cursor-pointer hover:scale-105"
                    title="Volver a la lectura del documento"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-gold-light" />
                    <span className="hidden sm:inline">Ver Lectura</span>
                  </button>
                </div>
              </div>

              {/* 2. PESTAÑAS PRINCIPALES DE RESULTADOS */}
              <div className="shrink-0 w-full bg-slate-900/95 border border-gold/40 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
                <div className="sticky top-0 z-20 flex border-b border-gold/20 bg-slate-950/95 backdrop-blur-md overflow-x-auto scrollbar-thin scrollbar-thumb-gold/30 touch-pan-x p-1.5 gap-1.5">
                  <button
                    onClick={() => setActiveResultsTab('posiciones')}
                    className={`flex-1 min-w-[140px] py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      activeResultsTab === 'posiciones' 
                        ? 'bg-gold/25 text-gold-light border border-gold/60 shadow-inner' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Trophy className="w-4 h-4 text-gold shrink-0" />
                    <span>Podio & Clasificación ({leaderboardList.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveResultsTab('revision')}
                    className={`flex-1 min-w-[140px] py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      activeResultsTab === 'revision' 
                        ? 'bg-gold/25 text-gold-light border border-gold/60 shadow-inner' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Recap ({myCorrectCount}/{activeQuestions.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveResultsTab('estadisticas')}
                    className={`flex-1 min-w-[140px] py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      activeResultsTab === 'estadisticas' 
                        ? 'bg-gold/25 text-gold-light border border-gold/60 shadow-inner' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Estadísticas Sala</span>
                  </button>
                  <button
                    onClick={() => setActiveResultsTab('global')}
                    className={`flex-1 min-w-[130px] py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      activeResultsTab === 'global' 
                        ? 'bg-gold/25 text-gold-light border border-gold/60 shadow-inner' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Crown className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>Tabla Global</span>
                  </button>
                </div>

                {/* Sub-barra de ayuda móvil para deslizar pestañas */}
                <div className="sm:hidden px-3 py-1 bg-slate-950/60 border-b border-gold/15 text-[10px] text-gray-400 flex items-center justify-between">
                  <span>← Desliza las pestañas →</span>
                  <span className="text-gold font-bold uppercase">{activeResultsTab}</span>
                </div>

                <div className="p-3 sm:p-5">
                  {/* TAB 1: PODIO DE HONOR Y TABLA GENERAL DE POSICIONES */}
                  {activeResultsTab === 'posiciones' && (() => {
                    const myRankIndex = leaderboardList.findIndex(p => String(p.id) === String(user?.id) || p.username === user?.username);
                    const myRecord = myRankIndex !== -1 ? leaderboardList[myRankIndex] : null;
                    const myRankNumber = myRecord ? (myRecord.rank || myRankIndex + 1) : null;

                    const filteredLeaderboardList = leaderboardList.filter(p => {
                      if (!resultsSearchQuery.trim()) return true;
                      const q = resultsSearchQuery.toLowerCase();
                      return (p.username || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q);
                    });

                    return (
                      <div className="space-y-4 sm:space-y-5">
                        
                        {/* A. PODIO OLÍMPICO COMPACTO Y PROPORCIONAL (Top 3) */}
                        <div className="bg-gradient-to-b from-slate-950/90 via-slate-900/90 to-slate-950 border border-gold/30 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
                          <div className="text-center mb-3 sm:mb-4">
                            <span className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-gold bg-gold/15 px-3 py-1 rounded-full border border-gold/30 shadow-sm inline-flex items-center gap-1.5">
                              🏆 Podio de Honor
                            </span>
                          </div>

                          {podiumList.length === 0 ? (
                            <div className="text-center py-6 text-gray-400 space-y-1.5">
                              <Trophy className="w-8 h-8 text-gold/40 mx-auto animate-pulse" />
                              <p className="text-xs">No se registraron participantes con respuestas en este quiz.</p>
                            </div>
                          ) : podiumList.length === 1 ? (
                            /* UN SOLO PARTICIPANTE */
                            <div className="w-full flex justify-center py-3 sm:py-5">
                              <div className="w-56 sm:w-64 bg-slate-950/80 border-2 border-yellow-500/50 rounded-2xl p-4 sm:p-5 flex flex-col items-center shadow-2xl relative overflow-hidden shrink-0">
                                <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-transparent pointer-events-none" />
                                <Crown className="w-7 h-7 text-yellow-300 mx-auto mb-1 animate-pulse" />
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-300 border-2 border-yellow-200 flex items-center justify-center text-3xl sm:text-4xl font-bold shadow-xl shadow-amber-500/30 mb-2">
                                  🥇
                                </div>
                                <span className="text-sm sm:text-base font-black text-gold-light truncate max-w-[200px] text-center" title={podiumList[0].username}>
                                  {podiumList[0].username}
                                </span>
                                <span className="text-sm sm:text-base font-mono font-black text-yellow-300 mt-0.5">
                                  {podiumList[0].score || 0} pts
                                </span>
                                <span className="text-xs text-yellow-200/80 font-bold mt-0.5 mb-3">
                                  {podiumList[0].correctCount}/{totalQuestionsCount} aciertos
                                </span>
                                <div className="w-full bg-gradient-to-t from-amber-950 via-amber-800 to-yellow-600/90 border border-yellow-400/60 rounded-xl py-2 flex flex-col items-center justify-center shadow-lg">
                                  <span className="text-xl sm:text-2xl font-black text-yellow-100">1º Puesto</span>
                                  <span className="text-[10px] uppercase tracking-wider text-yellow-300 font-extrabold">Gran Campeón</span>
                                </div>
                              </div>
                            </div>
                          ) : podiumList.length === 2 ? (
                            /* DOS PARTICIPANTES: 2º Plata (Izq) y 1º Oro (Der) */
                            <div className="w-full flex items-end justify-center gap-4 sm:gap-8 pt-2 pb-2 max-w-md mx-auto">
                              {/* 2º LUGAR */}
                              <div className="w-32 sm:w-40 flex flex-col items-center shrink-0">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-800 border-2 border-slate-300 flex items-center justify-center text-2xl font-bold shadow mb-1.5">
                                  🥈
                                </div>
                                <span className="text-xs sm:text-sm font-bold text-slate-200 truncate max-w-[130px] text-center" title={podiumList[1].username}>
                                  {podiumList[1].username}
                                </span>
                                <span className="text-xs sm:text-sm font-mono font-bold text-slate-300">
                                  {podiumList[1].score || 0} pts
                                </span>
                                <span className="text-[10px] sm:text-xs text-gray-400 mb-2">
                                  {podiumList[1].correctCount}/{totalQuestionsCount} aciertos
                                </span>
                                <div className="w-full bg-gradient-to-t from-slate-900 via-slate-800 to-slate-700 border-t-2 border-slate-300 rounded-t-xl h-16 sm:h-20 flex flex-col items-center justify-center shadow-inner">
                                  <span className="text-lg sm:text-xl font-black text-slate-200">2º</span>
                                  <span className="text-[9px] uppercase tracking-wider text-slate-300 font-bold">Subcampeón</span>
                                </div>
                              </div>

                              {/* 1º LUGAR */}
                              <div className="w-36 sm:w-44 flex flex-col items-center shrink-0 z-10">
                                <Crown className="w-6 h-6 text-yellow-300 mx-auto -mb-0.5 animate-pulse" />
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 border-2 border-yellow-200 flex items-center justify-center text-3xl font-bold shadow-lg shadow-amber-500/30 mb-1.5">
                                  🥇
                                </div>
                                <span className="text-sm sm:text-base font-black text-gold-light truncate max-w-[140px] text-center" title={podiumList[0].username}>
                                  {podiumList[0].username}
                                </span>
                                <span className="text-sm sm:text-base font-mono font-black text-yellow-300">
                                  {podiumList[0].score || 0} pts
                                </span>
                                <span className="text-xs text-yellow-300/80 font-bold mb-2">
                                  {podiumList[0].correctCount}/{totalQuestionsCount} aciertos
                                </span>
                                <div className="w-full bg-gradient-to-t from-amber-950 via-amber-800 to-yellow-600/90 border-t-2 border-yellow-300 rounded-t-xl h-24 sm:h-28 flex flex-col items-center justify-center shadow-2xl ring-1 ring-yellow-400/50">
                                  <span className="text-2xl sm:text-3xl font-black text-yellow-200">1º</span>
                                  <span className="text-[9px] uppercase tracking-wider text-yellow-300 font-extrabold">Campeón</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* TRES O MÁS PARTICIPANTES: 2º - 1º - 3º */
                            <div className="w-full flex items-end justify-center gap-3 sm:gap-6 md:gap-8 pt-2 pb-2 max-w-xl mx-auto">
                              {/* 2º LUGAR */}
                              <div className="w-28 sm:w-36 md:w-40 flex flex-col items-center shrink-0">
                                <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-slate-800 border-2 border-slate-300 flex items-center justify-center text-xl sm:text-2xl font-bold shadow mb-1.5">
                                  🥈
                                </div>
                                <span className="text-xs sm:text-sm font-bold text-slate-200 truncate max-w-[110px] sm:max-w-[130px] text-center" title={podiumList[1].username}>
                                  {podiumList[1].username}
                                </span>
                                <span className="text-xs font-mono font-bold text-slate-300">
                                  {podiumList[1].score || 0} pts
                                </span>
                                <span className="text-[10px] sm:text-xs text-gray-400 mb-2">
                                  {podiumList[1].correctCount}/{totalQuestionsCount} aciertos
                                </span>
                                <div className="w-full bg-gradient-to-t from-slate-900 via-slate-800 to-slate-700 border-t-2 border-slate-300 rounded-t-xl h-16 sm:h-20 flex flex-col items-center justify-center shadow-inner">
                                  <span className="text-lg sm:text-xl font-black text-slate-200">2º</span>
                                  <span className="text-[9px] uppercase tracking-wider text-slate-300 font-bold">Plata</span>
                                </div>
                              </div>

                              {/* 1º LUGAR */}
                              <div className="w-32 sm:w-40 md:w-44 flex flex-col items-center shrink-0 z-10">
                                <Crown className="w-6 h-6 text-yellow-300 mx-auto -mb-0.5 animate-pulse" />
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 border-2 border-yellow-200 flex items-center justify-center text-2xl sm:text-3xl font-bold shadow-lg shadow-amber-500/30 mb-1.5">
                                  🥇
                                </div>
                                <span className="text-xs sm:text-base font-black text-gold-light truncate max-w-[130px] sm:max-w-[150px] text-center" title={podiumList[0].username}>
                                  {podiumList[0].username}
                                </span>
                                <span className="text-sm font-mono font-black text-yellow-300">
                                  {podiumList[0].score || 0} pts
                                </span>
                                <span className="text-xs text-yellow-300/80 font-bold mb-2">
                                  {podiumList[0].correctCount}/{totalQuestionsCount} aciertos
                                </span>
                                <div className="w-full bg-gradient-to-t from-amber-950 via-amber-800 to-yellow-600/90 border-t-2 border-yellow-300 rounded-t-xl h-24 sm:h-28 flex flex-col items-center justify-center shadow-2xl ring-1 ring-yellow-400/50">
                                  <span className="text-2xl sm:text-3xl font-black text-yellow-200">1º</span>
                                  <span className="text-[9px] uppercase tracking-wider text-yellow-300 font-extrabold">Campeón</span>
                                </div>
                              </div>

                              {/* 3º LUGAR */}
                              <div className="w-28 sm:w-36 md:w-40 flex flex-col items-center shrink-0">
                                <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-slate-800 border-2 border-amber-600 flex items-center justify-center text-xl sm:text-2xl font-bold shadow mb-1.5">
                                  🥉
                                </div>
                                <span className="text-xs sm:text-sm font-bold text-amber-300 truncate max-w-[110px] sm:max-w-[130px] text-center" title={podiumList[2].username}>
                                  {podiumList[2].username}
                                </span>
                                <span className="text-xs font-mono font-bold text-amber-400">
                                  {podiumList[2].score || 0} pts
                                </span>
                                <span className="text-[10px] sm:text-xs text-gray-400 mb-2">
                                  {podiumList[2].correctCount}/{totalQuestionsCount} aciertos
                                </span>
                                <div className="w-full bg-gradient-to-t from-stone-950 via-stone-900 to-amber-900 border-t-2 border-amber-600 rounded-t-xl h-12 sm:h-16 flex flex-col items-center justify-center shadow-inner">
                                  <span className="text-base sm:text-lg font-black text-amber-400">3º</span>
                                  <span className="text-[9px] uppercase tracking-wider text-amber-500 font-bold">Bronce</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* B. BARRA DE CONTROL, BÚSQUEDA Y DESTACADO PERSONAL */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                          {/* Banner resumen personal si el usuario participó */}
                          {myRecord && myRecord.hasParticipated && (
                            <div className="w-full sm:w-auto bg-gold/15 border border-gold/40 rounded-xl px-3 py-1.5 text-xs text-gold-light flex items-center gap-2">
                              <span className="font-bold">✨ Tu resultado:</span>
                              <span className="font-mono font-black">{myRankNumber}º Puesto</span>
                              <span>•</span>
                              <span className="font-mono font-bold">+{myRecord.score || 0} pts</span>
                              <span>•</span>
                              <span>{myRecord.correctCount}/{totalQuestionsCount} aciertos</span>
                            </div>
                          )}

                          {/* Buscador de participante si hay varios */}
                          {leaderboardList.length > 3 && (
                            <div className="relative w-full sm:w-64 ml-auto">
                              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={resultsSearchQuery}
                                onChange={(e) => setResultsSearchQuery(e.target.value)}
                                placeholder="Buscar participante..."
                                className="w-full bg-slate-950/80 border border-white/10 focus:border-gold/50 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 outline-none transition-colors"
                              />
                            </div>
                          )}
                        </div>

                        {/* C. VISTA DE TABLA COMPLETA PARA TABLETS Y COMPUTADORAS (Desktop >= 640px) */}
                        <div className="hidden sm:block overflow-hidden rounded-xl border border-gold/30 shadow-lg bg-slate-950/60 w-full">
                          <div className="w-full max-h-[50vh] sm:max-h-[520px] overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-gold/30">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead className="sticky top-0 bg-slate-950 text-gold font-bold border-b border-gold/30 uppercase text-[10px] tracking-wider z-10">
                                <tr>
                                  <th className="py-2.5 px-3 text-center w-16">Puesto</th>
                                  <th className="py-2.5 px-4">Participante</th>
                                  <th className="py-2.5 px-4">Aciertos & Precisión</th>
                                  <th className="py-2.5 px-3 text-center">Tiempo Prom.</th>
                                  <th className="py-2.5 px-4 text-right">Puntos Meet</th>
                                  <th className="py-2.5 px-3 text-center w-32">Acción</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 bg-slate-900/60 font-medium">
                                {filteredLeaderboardList.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-400 text-xs">
                                      No se encontraron participantes en la búsqueda.
                                    </td>
                                  </tr>
                                ) : (
                                  filteredLeaderboardList.map((p, idx) => {
                                    const isMe = String(p.id) === String(user?.id);
                                    const isConnected = p.connected !== false;
                                    const correctCnt = p.correctCount !== undefined ? p.correctCount : 0;
                                    const totalQs = p.totalQuestions || totalQuestionsCount;
                                    const accuracyPct = totalQs > 0 ? Math.round((correctCnt / totalQs) * 100) : 0;
                                    const originalIndex = leaderboardList.findIndex(item => item.id === p.id);
                                    const rank = (originalIndex !== -1 ? originalIndex : idx) + 1;

                                    return (
                                      <tr 
                                        key={p.id || idx}
                                        className={`transition-colors hover:bg-white/5 ${
                                          isMe 
                                            ? 'bg-gold/20 font-bold border-l-4 border-l-gold' 
                                            : rank === 1 
                                            ? 'bg-amber-500/10' 
                                            : rank === 2 
                                            ? 'bg-slate-400/10' 
                                            : rank === 3 
                                            ? 'bg-amber-800/10' 
                                            : ''
                                        }`}
                                      >
                                        <td className="py-3 px-3 text-center font-black">
                                          {rank === 1 ? (
                                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-400/50 text-xs shadow-sm font-bold">🥇 1º</span>
                                          ) : rank === 2 ? (
                                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-400/20 text-slate-200 border border-slate-300/50 text-xs shadow-sm font-bold">🥈 2º</span>
                                          ) : rank === 3 ? (
                                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-amber-800/20 text-amber-300 border border-amber-600/50 text-xs shadow-sm font-bold">🥉 3º</span>
                                          ) : (
                                            <span className="text-gray-400 font-mono text-xs">{rank}º</span>
                                          )}
                                        </td>
                                        <td className="py-3 px-4">
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/20 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow">
                                              {(p.username || 'P').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                              <div className="flex items-center gap-1.5 truncate">
                                                <span className="font-bold text-white truncate text-xs sm:text-sm">{p.username}</span>
                                                {isMe && (
                                                  <span className="text-[10px] bg-gold/30 text-gold-light px-1.5 py-0.2 rounded border border-gold/50 font-bold shrink-0">
                                                    (Tú)
                                                  </span>
                                                )}
                                                {(p.isHost || ['admin', 'superadmin', 'lider', 'leader'].includes(p.role?.toLowerCase())) && (
                                                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded border border-blue-400/30 font-bold shrink-0">
                                                    Líder
                                                  </span>
                                                )}
                                                <span 
                                                  className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`}
                                                  title={isConnected ? 'Conectado a la sala' : 'Desconectado'}
                                                />
                                              </div>
                                              {p.totalPlatformPoints && (
                                                <span className="text-[10px] text-amber-300/80 font-mono block">
                                                  🌟 {p.totalPlatformPoints} acum. plataforma
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3 px-4">
                                          <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                              <span className="font-bold text-gray-200">{correctCnt} de {totalQs} aciertos</span>
                                              <span className="font-mono text-gray-400 text-[11px]">{accuracyPct}%</span>
                                            </div>
                                            <div className="w-32 md:w-40 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                              <div 
                                                className={`h-full transition-all ${accuracyPct >= 70 ? 'bg-emerald-400' : accuracyPct >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                                style={{ width: `${accuracyPct}%` }}
                                              />
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3 text-center font-mono text-gray-300 text-xs">
                                          {p.avgTimeSec ? `${p.avgTimeSec}s` : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                          <span className="font-mono font-black text-gold text-sm sm:text-base">
                                            +{p.score || 0} pts
                                          </span>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                          <button
                                            onClick={() => {
                                              setSelectedUserForRecap(p.id);
                                              setActiveResultsTab('revision');
                                            }}
                                            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-gold/25 hover:text-gold-light hover:border-gold/50 border border-white/10 text-[11px] font-bold text-gray-200 transition-all cursor-pointer whitespace-nowrap"
                                            title="Ver respuestas de este participante"
                                          >
                                            Ver Respuestas 🔍
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* D. VISTA DE TARJETAS RESPONSIVE PARA MÓVILES (Phone < 640px) */}
                        <div className="sm:hidden space-y-2.5">
                          {filteredLeaderboardList.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-xs">
                              No se encontraron participantes en la búsqueda.
                            </div>
                          ) : (
                            filteredLeaderboardList.map((p, idx) => {
                              const isMe = String(p.id) === String(user?.id);
                              const isConnected = p.connected !== false;
                              const correctCnt = p.correctCount !== undefined ? p.correctCount : 0;
                              const totalQs = p.totalQuestions || totalQuestionsCount;
                              const accuracyPct = totalQs > 0 ? Math.round((correctCnt / totalQs) * 100) : 0;
                              const originalIndex = leaderboardList.findIndex(item => item.id === p.id);
                              const rank = (originalIndex !== -1 ? originalIndex : idx) + 1;

                              return (
                                <div
                                  key={p.id || idx}
                                  className={`p-3 rounded-xl border text-xs font-semibold transition-all space-y-2.5 shadow-sm ${
                                    isMe 
                                      ? 'bg-gold/20 border-gold text-gold-light ring-1 ring-gold shadow-md' 
                                      : rank === 1 
                                      ? 'bg-amber-500/15 border-amber-400/60 text-amber-200' 
                                      : rank === 2 
                                      ? 'bg-slate-400/15 border-slate-300/60 text-slate-200' 
                                      : rank === 3 
                                      ? 'bg-amber-800/15 border-amber-700/60 text-amber-300' 
                                      : 'bg-white/5 border-white/10 text-gray-300'
                                  }`}
                                >
                                  {/* Fila 1: Puesto + Avatar + Nombre + Puntos */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-black text-xs px-2 py-0.5 rounded-md bg-slate-950/80 border border-white/10 shrink-0">
                                        {rank === 1 ? '🥇 1º' : rank === 2 ? '🥈 2º' : rank === 3 ? '🥉 3º' : `${rank}º`}
                                      </span>
                                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/20 flex items-center justify-center text-xs font-bold shrink-0 text-white shadow">
                                        {(p.username || 'P').charAt(0).toUpperCase()}
                                      </div>
                                      <span className="truncate font-bold text-white text-xs">{p.username}</span>
                                      {isMe && (
                                        <span className="text-[10px] bg-gold/30 text-gold-light px-1.5 py-0.2 rounded font-bold shrink-0">
                                          (Tú)
                                        </span>
                                      )}
                                      {(p.isHost || ['admin', 'superadmin', 'lider', 'leader'].includes(p.role?.toLowerCase())) && (
                                        <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.2 rounded border border-blue-400/30 font-bold shrink-0">
                                          Líder
                                        </span>
                                      )}
                                      <span 
                                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`}
                                        title={isConnected ? 'Conectado a la sala' : 'Desconectado'}
                                      />
                                    </div>

                                    <div className="text-right shrink-0">
                                      <span className="font-mono font-black text-gold text-sm block">
                                        +{p.score || 0} pts
                                      </span>
                                    </div>
                                  </div>

                                  {/* Fila 2: Aciertos + Tiempo + Botón Ver Respuestas */}
                                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-[11px] text-gray-400">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-gray-300 font-bold">🎯 {correctCnt}/{totalQs} aciertos</span>
                                      <span>({accuracyPct}%)</span>
                                      {p.avgTimeSec ? <span>• ⏱️ {p.avgTimeSec}s</span> : null}
                                    </div>

                                    <button
                                      onClick={() => {
                                        setSelectedUserForRecap(p.id);
                                        setActiveResultsTab('revision');
                                      }}
                                      className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[11px] font-bold text-gray-200 transition-all cursor-pointer whitespace-nowrap"
                                      title="Ver respuestas de este participante"
                                    >
                                      Ver Recap 🔍
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                      </div>
                    );
                  })()}

                  {/* TAB 2: RECAP DE RESPUESTAS INFALIBLE */}
                  {activeResultsTab === 'revision' && (() => {
                    const targetUserId = selectedUserForRecap || (user?.id ? String(user.id) : null);
                    const targetUserAnswers = (targetUserId && revealedResults?.allUserAnswers?.[targetUserId])
                      ? revealedResults.allUserAnswers[targetUserId]
                      : myAnswers;

                    const targetParticipant = leaderboardList.find(p => String(p.id) === String(targetUserId));
                    const targetName = targetParticipant?.username || user?.username || 'Participante';
                    const targetIsMe = String(targetUserId) === String(user?.id);

                    const targetCorrectCount = (Array.isArray(activeQuestions) ? activeQuestions : []).reduce((acc, q, idx) => {
                      const ans = targetUserAnswers?.[idx];
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
                          <div className="max-h-[55vh] sm:max-h-[550px] overflow-y-auto space-y-4 pr-1.5 scrollbar-thin scrollbar-thumb-gold/30 touch-pan-y overscroll-contain">
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
                      ? Math.round((Array.isArray(statsList) ? statsList : []).reduce((acc, curr) => acc + (curr.correctPercentage || 0), 0) / totalQs) 
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
                        <div className="max-h-[55vh] sm:max-h-[550px] overflow-y-auto space-y-3 pr-1.5 scrollbar-thin scrollbar-thumb-gold/30 touch-pan-y overscroll-contain">
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
                        <div className="max-h-[55vh] sm:max-h-[480px] overflow-y-auto space-y-2 pr-1.5 scrollbar-thin scrollbar-thumb-gold/30 touch-pan-y overscroll-contain">
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
              <div className="space-y-3 pt-2 shrink-0 w-full">
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

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setResultsViewMode('reading')}
                    className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400/50 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-xl hover:scale-105 transition-all cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-gold-light" />
                    <span>📖 Volver a la Lectura del Documento</span>
                  </button>

                  {isHost && (
                    <button
                      onClick={handleResumeReadingForEveryone}
                      className="inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-gray-200 font-bold text-xs sm:text-sm rounded-xl border border-gold/30 shadow hover:scale-105 transition-all cursor-pointer"
                      title="Reanudar la lectura para todos los participantes de la sala"
                    >
                      <RotateCcw className="w-4 h-4 text-gold" />
                      <span>Reanudar Lectura para Todos 🔄</span>
                    </button>
                  )}

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

      {/* MODAL DE PARTICIPANTES EN SALA Y EN PLATAFORMA */}
      {isRoomParticipantsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-gold/40 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-primary-dark via-primary to-primary-light border-b border-white/10 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold/20 border border-gold/40 flex items-center justify-center text-gold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-[Cinzel] font-bold text-base sm:text-lg text-white">
                    Participantes en Tiempo Real
                  </h3>
                  <p className="text-xs text-gold-light">
                    {connectedCount} en esta sala • {platformOnlineCount} en toda la plataforma
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRoomParticipantsModalOpen(false)}
                className="text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de pestañas (Pestaña "En Plataforma" visible exclusivamente para Líderes y Admin) */}
            {isLeaderOrAdmin ? (
              <div className="flex border-b border-white/10 bg-black/30 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setParticipantsModalTab('room')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    participantsModalTab === 'room'
                      ? 'bg-gold text-slate-950 shadow-md font-black'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>En esta Sala ({connectedCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setParticipantsModalTab('platform')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    participantsModalTab === 'platform'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>En Plataforma ({platformOnlineCount})</span>
                </button>
              </div>
            ) : (
              <div className="border-b border-white/10 bg-black/30 px-4 py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-gold font-bold">
                  <Users className="w-4 h-4" />
                  <span>Participantes en esta Sala ({connectedCount})</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{platformOnlineCount} en plataforma</span>
                </div>
              </div>
            )}

            {/* Contenido de la lista */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-white/5">
              {(!isLeaderOrAdmin || participantsModalTab === 'room') ? (
                connectedParticipants && connectedParticipants.length > 0 ? (
                  connectedParticipants.map((p, idx) => {
                    const isMe = user?.id && String(p.id || p.userId) === String(user.id);
                    return (
                      <div key={p.id || idx} className="pt-2.5 first:pt-0 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-primary-light text-white font-bold flex items-center justify-center text-xs border border-white/20 shadow-sm">
                              {(p.username || 'P').substring(0, 2).toUpperCase()}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 ring-1 ring-emerald-300"></span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-white text-xs sm:text-sm">{p.username}</span>
                              {isMe && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold px-1.5 py-0.2 rounded">Tú</span>
                              )}
                              {p.isHost && (
                                <span className="text-[10px] bg-gold/20 text-gold-light border border-gold/40 font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                  <Crown className="w-2.5 h-2.5 text-gold" />
                                  <span>Líder</span>
                                </span>
                              )}
                              {p.handRaised && (
                                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold px-1.5 py-0.2 rounded">✋ Mano levantada</span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                              {phase === 'quiz' && (
                                <span className="text-amber-400 font-mono">
                                  {p.isFinished ? '✅ Completó el Quiz' : '⏳ Respondiendo...'}
                                </span>
                              )}
                              {phase === 'finished' && (
                                <span className="text-gold font-mono font-bold">
                                  {p.score || 0} pts
                                </span>
                              )}
                              {phase === 'reading' && (
                                <span className="text-emerald-400 font-medium">● En la sala de lectura</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>En Sala</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    No hay participantes conectados actualmente.
                  </div>
                )
              ) : (
                /* Tab Plataforma */
                platformOnlineUsers && platformOnlineUsers.length > 0 ? (
                  platformOnlineUsers.map((u, idx) => {
                    const isMe = user?.id && String(u.id) === String(user.id);
                    return (
                      <div key={u.id || idx} className="pt-2.5 first:pt-0 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs border border-white/10">
                              {(u.username || 'U').substring(0, 2).toUpperCase()}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900"></span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-white text-xs sm:text-sm">{u.username}</span>
                              {isMe && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded">Tú</span>
                              )}
                              {(u.role === 'admin' || u.role === 'superadmin') && (
                                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-1.5 py-0.2 rounded">
                                  {u.role === 'superadmin' ? 'Superadmin' : 'Líder'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {u.points ? `${u.points} Puntos` : 'Conectado a la plataforma'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            ● En Línea
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    {platformOnlineCount} persona(s) conectadas en la plataforma.
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-black/40 border-t border-white/10 text-center">
              <button
                type="button"
                onClick={() => setIsRoomParticipantsModalOpen(false)}
                className="w-full sm:w-auto px-6 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Progreso del Quiz en Vivo (Listos y En Progreso) */}
      {isQuizProgressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border-2 border-gold/40 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gold" />
                <h3 className="text-base font-bold text-white font-[Cinzel]">
                  Progreso del Quiz en Vivo
                </h3>
              </div>
              <button
                onClick={() => setIsQuizProgressModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Barra de progreso */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-300 font-semibold">
                  <span>{effectiveFinishedCount} de {effectiveTotalParticipants} completaron</span>
                  <span className="text-gold font-mono">
                    {effectiveTotalParticipants > 0 ? Math.round((effectiveFinishedCount / effectiveTotalParticipants) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-gradient-to-r from-gold to-emerald-400 transition-all duration-500"
                    style={{ width: `${effectiveTotalParticipants > 0 ? (effectiveFinishedCount / effectiveTotalParticipants) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Listas */}
              <div className="space-y-3">
                {/* Listos */}
                <div>
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>Listos ({readyParticipants.length})</span>
                    </span>
                    <span className="text-[10px] text-emerald-300/80 font-normal">Concluyeron</span>
                  </p>
                  {readyParticipants.length === 0 ? (
                    <p className="text-xs text-gray-500 italic p-2 rounded bg-slate-950/40 border border-white/5">
                      Esperando que los hermanos concluyan...
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {readyParticipants.map(p => (
                        <div key={p.id} className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                          p.isMe 
                            ? 'bg-emerald-900/40 border-emerald-400/50 text-emerald-100 ring-1 ring-emerald-400/40' 
                            : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                        }`}>
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-semibold truncate">{p.username}</span>
                            {p.isMe && <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1 rounded font-bold">(Tú)</span>}
                          </div>
                          <span className="font-mono text-emerald-400 font-bold ml-2 shrink-0">{p.score} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* En progreso */}
                <div>
                  <p className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>En Progreso ({inProgressParticipants.length})</span>
                    </span>
                    <span className="text-[10px] text-amber-300/80 font-normal">Respondiendo</span>
                  </p>
                  {inProgressParticipants.length === 0 ? (
                    <p className="text-xs text-gray-500 italic p-2 rounded bg-slate-950/40 border border-white/5">
                      Ningún hermano en progreso
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {inProgressParticipants.map(p => (
                        <div key={p.id} className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                          p.isMe 
                            ? 'bg-amber-900/30 border-amber-400/50 text-amber-100 ring-1 ring-amber-400/40' 
                            : 'bg-amber-950/25 border-amber-500/30 text-amber-200'
                        }`}>
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate">{p.username}</span>
                            {p.isMe && <span className="text-[9px] bg-amber-500/30 text-amber-300 px-1 rounded font-bold">(Tú)</span>}
                          </div>
                          <span className="text-[10px] text-amber-400 font-mono ml-2 shrink-0">
                            Pregunta {Math.min(activeQuestions.length, (p.completedCount || 0) + 1)}/{activeQuestions.length} ⏳
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-white/10 bg-slate-950/60 flex justify-end">
              <button
                onClick={() => setIsQuizProgressModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MeetRoomPage;
