import { useState, useEffect, useRef } from 'react';
import { 
  Swords, Shield, Zap, CheckCircle2, XCircle, ArrowRight, Clock, 
  Users, AlertTriangle, Download, RefreshCw, Lock, Unlock, Trophy, 
  UserCheck, X, Search, Play, Flame, RotateCcw, Target, Award, Star
} from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../shared/Modal';

// Helper de audio sintetizado
const playTone = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'buzzer') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'correct') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(150, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'tick') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    }
  } catch (e) {}
};

export default function DavidGoliatEngine({ 
  qualifiedPlayers = [],
  availableUsers = [], 
  onCompletePhase, 
  onOpenDisciplinary 
}) {
  const { user: currentUser, refreshUser } = useAuth();

  // Jugador activo es ESTRICTAMENTE la cuenta conectada del usuario
  const activePlayer = currentUser ? {
    id: currentUser.id,
    username: currentUser.username || 'Mi Cuenta',
    points: typeof currentUser.points === 'number' ? currentUser.points : 0,
    role: currentUser.role || 'user',
    badge: '👑'
  } : {
    id: 'local_user',
    username: 'Mi Cuenta',
    points: 0,
    role: 'user',
    badge: '👑'
  };

  // Lista de participantes de la plataforma para la tabla comparativa
  const effectivePlayers = (Array.isArray(availableUsers) && availableUsers.length > 0)
    ? availableUsers
    : ((Array.isArray(qualifiedPlayers) && qualifiedPlayers.length > 0) ? qualifiedPlayers : [
        { id: activePlayer.id, username: activePlayer.username, points: activePlayer.points, badge: '👑' }
      ]);

  // Vista activa: 'player' (Apartado Individual de Combate) | 'leaderboard' (Tabla de Rendimiento de David vs Goliat)
  const [activeView, setActiveView] = useState('player');

  // Récords individuales de David contra Goliat: playerId -> { bestScore, runs: [...] }
  const [playerRecords, setPlayerRecords] = useState(() => {
    try {
      const saved = localStorage.getItem('simulacro_david_player_records');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('simulacro_david_player_records', JSON.stringify(playerRecords));
    } catch (e) {}
  }, [playerRecords]);

  // Estado de las 20 preguntas del desafío contra Goliat
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0); // 0 a 19
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [importNotification, setImportNotification] = useState('');

  // Estados del juego individual
  const [isPlaying, setIsPlaying] = useState(false);
  const [roundFinished, setRoundFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [timeoutCount, setTimeoutCount] = useState(0);
  const [wisdomAwarded, setWisdomAwarded] = useState(null);

  // Estados del Buzzer individual (Pulsador de David) y 10 segundos
  const [buzzerPressed, setBuzzerPressed] = useState(false);
  const [answerTimeLeft, setAnswerTimeLeft] = useState(10);
  const [answeredState, setAnsweredState] = useState(null); // { isCorrect, selectedOpt, message }
  const [selectedOptKey, setSelectedOptKey] = useState(null);

  const answerTimerRef = useRef(null);

  // Cargar preguntas iniciales de David contra Goliat
  useEffect(() => {
    load20Questions();

    const handleQuestionsUpdated = () => {
      load20Questions();
    };
    window.addEventListener('remanente-simulacro-questions-updated', handleQuestionsUpdated);
    return () => window.removeEventListener('remanente-simulacro-questions-updated', handleQuestionsUpdated);
  }, []);

  const load20Questions = async () => {
    setLoadingQuestions(true);
    try {
      const res = await api.get('/simulacro/questions/david-goliat/import-from-fire');
      if (res && res.questions && res.questions.length > 0) {
        setQuestions(res.questions.slice(0, 20));
      } else {
        const res2 = await api.get('/simulacro/questions/david-goliat');
        if (res2 && res2.questions) setQuestions(res2.questions.slice(0, 20));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Re-importar 20 preguntas desde Fire Questions
  const handleImportQuestions = async () => {
    setLoadingQuestions(true);
    setImportNotification('');
    try {
      const res = await api.get('/simulacro/questions/david-goliat/import-from-fire');
      if (res && res.questions) {
        setQuestions(res.questions.slice(0, 20));
        setQIndex(0);
        setBuzzerPressed(false);
        setAnsweredState(null);
        setSelectedOptKey(null);
        setImportNotification('¡20 preguntas equilibradas de las 4 categorías importadas con éxito!');
        setTimeout(() => setImportNotification(''), 4000);
      }
    } catch (e) {
      alert('Error importando preguntas.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Iniciar el desafío individual de 20 preguntas contra Goliat
  const handleStartChallenge = () => {
    setIsPlaying(true);
    setRoundFinished(false);
    setQIndex(0);
    setScore(0);
    setCorrectCount(0);
    setIncorrectCount(0);
    setTimeoutCount(0);
    setBuzzerPressed(false);
    setAnsweredState(null);
    setSelectedOptKey(null);
    setAnswerTimeLeft(10);
    setWisdomAwarded(null);
  };

  // Temporizador de 10 segundos tras activar el pulsador de David
  useEffect(() => {
    if (isPlaying && buzzerPressed && !answeredState && answerTimeLeft > 0 && !roundFinished) {
      answerTimerRef.current = setInterval(() => {
        setAnswerTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(answerTimerRef.current);
            handleTimeoutFail();
            return 0;
          }
          if (prev <= 4) {
            playTone('tick');
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (answerTimerRef.current) clearInterval(answerTimerRef.current);
    };
  }, [isPlaying, buzzerPressed, answeredState, answerTimeLeft, roundFinished]);

  // Presionar Pulsador / Activar Honda de David
  const handlePressBuzzer = () => {
    if (!isPlaying || buzzerPressed || answeredState || roundFinished || !questions[qIndex]) return;
    setBuzzerPressed(true);
    setAnswerTimeLeft(10);
    setSelectedOptKey(null);
    playTone('buzzer');
  };

  // Controles por teclado: Tecla Espacio / Enter para Pulsar; A, B, C, D o 1, 2, 3, 4 para responder
  useEffect(() => {
    if (!isPlaying || roundFinished) return;

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (!buzzerPressed && !answeredState) {
        if (key === ' ' || key === 'enter' || key === 'a' || key === 'l') {
          e.preventDefault();
          handlePressBuzzer();
        }
      } else if (buzzerPressed && !answeredState) {
        if (key === 'a' || key === '1') handleSelectOption('a');
        else if (key === 'b' || key === '2') handleSelectOption('b');
        else if (key === 'c' || key === '3') handleSelectOption('c');
        else if (key === 'd' || key === '4') handleSelectOption('d');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, buzzerPressed, answeredState, roundFinished, qIndex, questions]);

  // Tiempo agotado en los 10 segundos tras pulsar
  const handleTimeoutFail = () => {
    if (!buzzerPressed || answeredState) return;
    setTimeoutCount(prev => prev + 1);
    playTone('wrong');
    setAnsweredState({
      isCorrect: false,
      selectedOpt: null,
      message: '¡Tiempo agotado! La piedra no alcanzó al objetivo (0 puntos).'
    });
  };

  // Selección de una de las 4 opciones dentro del tiempo de 10s
  const handleSelectOption = (optKey) => {
    if (!buzzerPressed || answeredState || roundFinished || !questions[qIndex]) return;

    if (answerTimerRef.current) clearInterval(answerTimerRef.current);
    setSelectedOptKey(optKey);

    const curQ = questions[qIndex];
    const isCorrect = (curQ.correct_answer || 'a').toLowerCase() === optKey.toLowerCase();

    if (isCorrect) {
      setScore(prev => prev + 10);
      setCorrectCount(prev => prev + 1);
      playTone('correct');
      setAnsweredState({
        isCorrect: true,
        selectedOpt: optKey,
        message: '¡Impacto Certero! Piedra en la frente de Goliat (+10 puntos).'
      });
    } else {
      setIncorrectCount(prev => prev + 1);
      playTone('wrong');
      setAnsweredState({
        isCorrect: false,
        selectedOpt: optKey,
        message: '¡Fallo! La respuesta no fue correcta (0 puntos).'
      });
    }
  };

  // Pasar a la siguiente pregunta de las 20
  const handleNextQuestion = () => {
    if (qIndex < 19 && qIndex < questions.length - 1) {
      setQIndex(prev => prev + 1);
      setBuzzerPressed(false);
      setAnsweredState(null);
      setSelectedOptKey(null);
      setAnswerTimeLeft(10);
    } else {
      handleFinishChallenge();
    }
  };

  // Finalizar el desafío de 20 preguntas contra Goliat
  const handleFinishChallenge = () => {
    if (answerTimerRef.current) clearInterval(answerTimerRef.current);
    setIsPlaying(false);
    setRoundFinished(true);

    // Guardar récord del jugador
    setScore(finalScore => {
      // Transferir puntos ganados a la cuenta del usuario como Puntos de Sabiduría en Supabase
      if (finalScore > 0 && currentUser?.id) {
        api.post('/simulacro/points/award', {
          competition: 'david',
          score: finalScore,
          details: { correctCount, incorrectCount, timeouts: timeoutCount }
        }).then(res => {
          if (res && res.success) {
            setWisdomAwarded({
              points: finalScore,
              newTotal: res.newTotalPoints
            });
            refreshUser?.();
            window.dispatchEvent(new CustomEvent('remanente-leaderboard-update'));
          }
        }).catch(err => console.warn('[Simulacro] Error acreditando sabiduría:', err));
      }

      setPlayerRecords(prev => {
        const pId = String(activePlayer.id);
        const existing = prev[pId] || { bestScore: 0, runs: [] };
        const newBest = Math.max(existing.bestScore || 0, finalScore);

        return {
          ...prev,
          [pId]: {
            player: activePlayer,
            bestScore: newBest,
            lastScore: finalScore,
            totalRuns: (existing.runs?.length || 0) + 1,
            runs: [{
              score: finalScore,
              correct: correctCount,
              incorrect: incorrectCount,
              timeouts: timeoutCount,
              date: new Date().toISOString()
            }, ...(existing.runs || [])].slice(0, 10)
          }
        };
      });
      return finalScore;
    });
  };

  // Tabla general de David contra Goliat ordenada por mejor puntaje
  const sortedLeaderboard = effectivePlayers.map(p => {
    const rec = playerRecords[String(p.id)];
    return {
      player: p,
      bestScore: rec ? rec.bestScore : 0,
      totalRuns: rec ? rec.totalRuns : 0,
      hasDefeatedGoliat: (rec?.bestScore || 0) >= 120
    };
  }).sort((a, b) => b.bestScore - a.bestScore);

  const top2Finalists = sortedLeaderboard.slice(0, 2);

  // Avanzar a Fase 3 (El Dado Dado)
  const handleAdvanceToPhase3 = () => {
    if (onCompletePhase) {
      onCompletePhase({
        phase: 'david_goliat',
        finalistPlayers: top2Finalists.map((entry, idx) => ({
          ...entry.player,
          seed: idx + 1,
          davidScore: entry.bestScore
        })),
        finalists: top2Finalists.map((entry, idx) => ({
          ...entry.player,
          seed: idx + 1,
          davidScore: entry.bestScore
        })),
        fullStandings: sortedLeaderboard
      });
    }
  };

  const currentQ = questions[qIndex];
  const activeRecord = playerRecords[String(activePlayer.id)];

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* HEADER DE LA SECCIÓN */}
      <div className="bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 border-2 border-blue-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 flex items-center justify-center text-3xl shadow-lg shadow-blue-500/30 text-white font-black">
            ⚔️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/15 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                Fase 2 • Desafío Individual
              </span>
              <span className="text-xs text-slate-400 font-mono">20 Preguntas • Pulsador de 10s</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-serif text-white tracking-wide mt-0.5">
              David contra Goliat: Desafío al Gigante
            </h1>
          </div>
        </div>

        {/* Acciones del Header */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={() => setActiveView(activeView === 'leaderboard' ? 'player' : 'leaderboard')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer border ${
              activeView === 'leaderboard'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Trophy className="w-4 h-4 text-gold" />
            <span>{activeView === 'leaderboard' ? 'Volver a Mi Combate' : '🏆 Tabla de Posiciones'}</span>
          </button>

          <button
            onClick={handleImportQuestions}
            disabled={loadingQuestions}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600/30 to-amber-500/20 hover:from-amber-600/40 hover:to-amber-500/30 border border-amber-500/50 text-amber-300 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition shadow cursor-pointer"
            title="Importar 20 preguntas equilibradas de las 4 subcategorías de Fire Questions"
          >
            <Download className={`w-4 h-4 ${loadingQuestions ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Importar 20 de Fire</span>
          </button>

          <button
            onClick={() => onOpenDisciplinary && onOpenDisciplinary(activePlayer)}
            className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Shield className="w-4 h-4 text-red-400" />
            <span>Arbitraje</span>
          </button>
        </div>
      </div>

      {/* Notificación de Importación */}
      {importNotification && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500 text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-fadeIn shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{importNotification}</span>
        </div>
      )}

      {/* VISTA 1: TABLA GENERAL DE DAVID CONTRA GOLIAT */}
      {activeView === 'leaderboard' ? (
        <div className="bg-slate-900/90 border border-blue-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-gold" />
                <span>Clasificación Oficial • David contra Goliat</span>
              </span>
              <h2 className="text-2xl font-black font-serif text-white mt-1">
                Tabla de Posiciones del Desafío al Gigante
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Rendimiento de los participantes registrados. Cada quien compite exclusivamente para su cuenta personal.
              </p>
            </div>

            <button
              onClick={() => setActiveView('player')}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500 hover:from-blue-500 hover:to-amber-400 text-white font-black text-xs sm:text-sm rounded-xl shadow-xl flex items-center gap-2 cursor-pointer uppercase tracking-wider shrink-0"
            >
              <span>Volver a Mi Combate</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {sortedLeaderboard.map((item, idx) => {
              const isFinalist = idx < 2 && item.bestScore > 0;
              const isMe = String(item.player.id) === String(activePlayer.id);

              return (
                <div
                  key={item.player.id}
                  className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                    isMe
                      ? 'bg-blue-950/50 border-blue-400 ring-2 ring-blue-500 shadow-xl'
                      : isFinalist
                      ? 'bg-gradient-to-r from-blue-950/40 via-slate-950/80 to-slate-950 border-blue-500/40 shadow-lg'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-black text-xs ${
                      idx === 0 
                        ? 'bg-gradient-to-tr from-yellow-400 to-amber-500 text-slate-950 shadow-md' 
                        : idx === 1 
                        ? 'bg-slate-300 text-slate-950' 
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {idx + 1}º
                    </span>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-700 flex items-center justify-center text-white font-black text-sm shadow">
                        {(item.player.username || item.player.name || 'J').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm sm:text-base">
                            {item.player.username || item.player.name}
                          </span>
                          {isMe && (
                            <span className="text-[10px] font-black uppercase bg-blue-500 text-white px-2 py-0.5 rounded-full shadow">
                              ⭐ Tu Cuenta
                            </span>
                          )}
                          {isFinalist && !isMe && (
                            <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                              Top 2
                            </span>
                          )}
                          {item.hasDefeatedGoliat && (
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              🪨 Derribó al Gigante
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {item.totalRuns} {item.totalRuns === 1 ? 'intento completado' : 'intentos completados'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <span className="text-xl sm:text-2xl font-black font-mono text-amber-400 block">
                        {item.bestScore} / 200 <span className="text-xs text-slate-400 font-normal">pts</span>
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">Mejor Marca</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* VISTA 2: APARTADO INDIVIDUAL DEL JUGADOR */
        <div className="space-y-6">

          {/* PERFIL DEL JUGADOR Y BARRA DE PROGRESO DE DERRIBO DE GOLIAT */}
          <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/30 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 flex items-center justify-center text-white text-xl font-black shadow-lg border border-blue-400/30">
                {(activePlayer.username || activePlayer.name || 'J').substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                    Tu Cuenta Personal
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    20 Preguntas Oficiales NTV
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white font-serif mt-0.5">
                  {activePlayer.username || activePlayer.name}
                </h2>
              </div>
            </div>

            {/* Marcador de Desafío Individual */}
            <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl w-full md:w-auto justify-between md:justify-start">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Récord en David vs Goliat</span>
                <span className="text-2xl font-black font-mono text-amber-400">
                  {activeRecord?.bestScore || 0} <span className="text-xs text-slate-400 font-normal">pts</span>
                </span>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Intentos Realizados</span>
                <span className="text-base font-bold font-mono text-slate-200">
                  {activeRecord?.runs?.length || 0}
                </span>
              </div>
            </div>
          </div>

          {/* ESTADO 1: ANTES DE INICIAR LAS 20 PREGUNTAS */}
          {!isPlaying && !roundFinished && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center mx-auto text-3xl">
                🪨
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <span className="text-xs font-black uppercase tracking-widest text-blue-400 font-mono">
                  Concepto y Estilo de David contra Goliat
                </span>
                <h3 className="text-2xl font-black font-serif text-white">
                  ¿Listo para el desafío de 20 preguntas, <span className="text-amber-400">{activePlayer.username || activePlayer.name}</span>?
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Enfrentarás 20 preguntas de alta precisión bíblica (5 de Personajes, 5 de Lugares, 5 de Cantidades y 5 de Eventos).
                </p>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 text-left space-y-1">
                  <p>⚡ <strong>Mecánica del Pulsador (Honda de David):</strong></p>
                  <p>• Presiona el pulsador (o barra espaciadora) para activar la pregunta.</p>
                  <p>• Tendrás <strong>10 segundos</strong> exactos para responder entre las 4 opciones.</p>
                  <p>• Acierto dentro de los 10s: <strong>+10 puntos</strong> certeros.</p>
                  <p>• Fallo o tiempo agotado: 0 puntos.</p>
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <button
                  onClick={handleStartChallenge}
                  disabled={loadingQuestions || questions.length === 0}
                  className="px-8 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500 hover:from-blue-500 hover:to-amber-400 text-white font-black text-sm rounded-xl shadow-xl shadow-blue-600/30 flex items-center gap-2 cursor-pointer uppercase tracking-wider transition transform hover:scale-105 active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>{loadingQuestions ? 'Cargando preguntas...' : 'Iniciar Desafío (20 Preguntas)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ESTADO 2: JUGANDO LAS 20 PREGUNTAS INDIVIDUALES */}
          {isPlaying && currentQ && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 animate-fadeIn">
              
              {/* Barra de progreso de preguntas y puntaje */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-amber-400">
                    Pregunta {qIndex + 1} de {questions.length}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-300 font-semibold">+10 Puntos por Acierto</span>
                  {currentQ.source_category && (
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 uppercase text-[10px] font-bold">
                      {currentQ.source_category}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {currentQ.verse_reference && (
                    <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-slate-300 text-[11px]">
                      📖 {currentQ.verse_reference}
                    </span>
                  )}
                  <span className="text-xl font-black font-mono text-amber-400">
                    {score} <span className="text-xs text-slate-400 font-normal">pts</span>
                  </span>
                </div>
              </div>

              {/* Barra de Vida / Derribo de Goliat */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Derribo del Gigante Goliat</span>
                  <span>{correctCount} de 20 aciertos ({Math.round((correctCount / 20) * 100)}%)</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-400 transition-all duration-300"
                    style={{ width: `${((qIndex) / 20) * 100}%` }}
                  />
                </div>
              </div>

              {/* Enunciado de la Pregunta */}
              <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800">
                <h3 className="text-lg sm:text-2xl font-bold text-white leading-relaxed">
                  {currentQ.question_text}
                </h3>
              </div>

              {/* ZONA DEL PULSADOR (BUZZER DE DAVID) */}
              {!buzzerPressed && !answeredState && (
                <div className="p-5 rounded-2xl bg-slate-950/70 border border-dashed border-blue-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30 animate-bounce">
                      <Target className="w-6 h-6 text-gold" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">¡Activa la Honda de David!</h4>
                      <p className="text-xs text-slate-400">
                        Presiona el pulsador para disparar. Tendrás <strong>10 segundos</strong> para seleccionar la opción correcta.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handlePressBuzzer}
                    className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500 hover:from-blue-500 hover:to-amber-400 text-white font-black text-sm rounded-xl shadow-xl transition transform hover:scale-105 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    <span>ACTIVAR PULSADOR (Espacio)</span>
                  </button>
                </div>
              )}

              {/* CUENTA REGRESIVA DE 10 SEGUNDOS TRAS ACTIVAR PULSADOR */}
              {buzzerPressed && !answeredState && (
                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                      <Clock className="w-6 h-6 animate-spin" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-amber-300">
                        ¡Pulsador activado! Selecciona tu respuesta:
                      </h4>
                      <p className="text-xs text-slate-300">
                        Tienes <strong className="text-white font-mono">{answerTimeLeft} segundos</strong> antes de que se agote el tiempo.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-2xl sm:text-3xl font-mono font-black px-4 py-1 rounded-xl border ${
                      answerTimeLeft <= 3 
                        ? 'bg-red-500 text-white border-red-400 animate-ping' 
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {answerTimeLeft}s
                    </span>
                  </div>
                </div>
              )}

              {/* LAS 4 OPCIONES DE RESPUESTA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {['a', 'b', 'c', 'd'].map(optKey => {
                  const optText = currentQ[`option_${optKey}`];
                  if (!optText) return null;

                  const isCorrect = (currentQ.correct_answer || 'a').toLowerCase() === optKey;
                  const isSelected = selectedOptKey === optKey;

                  let btnStyle = 'bg-slate-950/80 border-slate-800 text-slate-200';
                  let badge = null;

                  if (answeredState) {
                    if (isCorrect) {
                      btnStyle = 'bg-emerald-950/90 border-emerald-500 text-emerald-100 ring-2 ring-emerald-400 shadow-lg shadow-emerald-950/50 scale-[1.01]';
                      badge = (
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 text-[11px] font-black border border-emerald-400 flex items-center gap-1 shrink-0 animate-pulse">
                          ✓ Correcta
                        </span>
                      );
                    } else if (isSelected && !isCorrect) {
                      btnStyle = 'bg-red-950/90 border-red-500 text-red-200 line-through ring-2 ring-red-400 opacity-90';
                      badge = (
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-red-500/30 text-red-300 text-[11px] font-black border border-red-400 flex items-center gap-1 shrink-0">
                          ✗ Tu Elección
                        </span>
                      );
                    } else {
                      btnStyle = 'bg-slate-950/40 border-slate-900 text-slate-600 opacity-40';
                    }
                  } else if (buzzerPressed) {
                    btnStyle = 'bg-slate-950 border-amber-500/40 text-white hover:border-amber-400 hover:bg-amber-950/30 cursor-pointer shadow-md';
                  } else {
                    btnStyle = 'bg-slate-950/50 border-slate-800 text-slate-500 cursor-not-allowed';
                  }

                  return (
                    <button
                      key={optKey}
                      onClick={() => handleSelectOption(optKey)}
                      disabled={!buzzerPressed || answeredState !== null}
                      className={`p-4 rounded-2xl border-2 text-left transition-all duration-150 flex items-start gap-3 ${btnStyle}`}
                    >
                      <span className={`w-8 h-8 rounded-xl border flex items-center justify-center font-mono font-bold text-xs uppercase shrink-0 ${
                        answeredState && isCorrect
                          ? 'bg-emerald-800 border-emerald-400 text-white font-black'
                          : answeredState && isSelected && !isCorrect
                          ? 'bg-red-900 border-red-400 text-white font-black'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}>
                        {optKey}
                      </span>
                      <span className="text-sm sm:text-base font-medium leading-snug pt-1 flex-1">
                        {optText}
                      </span>
                      {badge}
                    </button>
                  );
                })}
              </div>

              {/* FEEDBACK Y BOTÓN DE SIGUIENTE PREGUNTA */}
              {answeredState && (
                <div className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn ${
                  answeredState.isCorrect 
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200' 
                    : 'bg-red-950/60 border-red-500 text-red-200'
                }`}>
                  <div className="flex items-start gap-3">
                    {answeredState.isCorrect ? (
                      <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-7 h-7 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="text-base font-black">
                        {answeredState.isCorrect ? '¡Impacto Certero! (+10 pts)' : '¡Tiro Fallido! (0 pts)'}
                      </h4>
                      <p className="text-xs sm:text-sm font-semibold opacity-90 mt-0.5">
                        {answeredState.message}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-xs bg-slate-950/90 px-2.5 py-1 rounded-lg border border-slate-700 font-bold text-white">
                          Respuesta correcta: <strong className="text-emerald-400 uppercase">{(currentQ.correct_answer || 'a')})</strong> {currentQ[`option_${(currentQ.correct_answer || 'a').toLowerCase()}`]}
                        </span>
                      </div>
                      {currentQ.explanation && (
                        <p className="text-[11px] text-slate-300 mt-1 italic">
                          💡 {currentQ.explanation}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleNextQuestion}
                    className="w-full sm:w-auto px-6 py-2.5 bg-white text-slate-950 hover:bg-slate-200 font-black text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <span>{qIndex >= 19 || qIndex >= questions.length - 1 ? 'Ver Resultado Final' : 'Siguiente Pregunta'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

            </div>
          )}

          {/* ESTADO 3: DESAFÍO FINALIZADO (RESUMEN INDIVIDUAL) */}
          {roundFinished && (
            <div className="bg-slate-900/90 border border-blue-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-amber-500 text-white flex items-center justify-center mx-auto text-3xl shadow-xl shadow-blue-500/30">
                <Trophy className="w-8 h-8 text-white animate-bounce" />
              </div>

              <div className="space-y-1">
                <span className="text-xs uppercase font-extrabold text-blue-400 tracking-widest font-mono">
                  ¡Desafío de 20 Preguntas Completado!
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-serif text-white">
                  {activePlayer.username || activePlayer.name} obtuvo <span className="text-amber-400 font-mono">{score} / 200 puntos</span>
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto pt-1">
                  {score >= 120 
                    ? '🎉 ¡Victoria Gloriosa! Derribaste al gigante Goliat con tu conocimiento bíblico.'
                    : 'Goliat resistió tus ataques. Sigue practicando para superarlo en tu próximo intento.'}
                </p>
              </div>

              {/* Estadísticas de la Ronda */}
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/30">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block">Certeros (+10)</span>
                  <span className="text-2xl font-black font-mono text-emerald-300 mt-0.5 block">{correctCount}</span>
                </div>

                <div className="p-3 bg-red-950/40 rounded-xl border border-red-500/30">
                  <span className="text-[10px] uppercase font-bold text-red-400 block">Fallos (0 pts)</span>
                  <span className="text-2xl font-black font-mono text-red-300 mt-0.5 block">{incorrectCount}</span>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Tiempo Agotado</span>
                  <span className="text-2xl font-black font-mono text-slate-300 mt-0.5 block">{timeoutCount}</span>
                </div>
              </div>

              {/* Banner de Puntos de Sabiduría Acreditados */}
              {wisdomAwarded && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/20 via-amber-500/25 to-blue-500/20 border-2 border-amber-400/80 shadow-xl max-w-md mx-auto space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
                    <span className="text-sm font-black text-amber-300 uppercase tracking-wider">
                      ¡+{wisdomAwarded.points} Puntos de Sabiduría Transferidos!
                    </span>
                  </div>
                  <p className="text-xs text-amber-100">
                    Acreditados directamente a tu cuenta en Supabase. {typeof wisdomAwarded.newTotal === 'number' && (
                      <span className="font-bold text-amber-200">Saldo actual: {wisdomAwarded.newTotal} pts</span>
                    )}
                  </p>
                </div>
              )}

              {/* Acciones */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setRoundFinished(false);
                    setIsPlaying(false);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500 hover:from-blue-500 hover:to-amber-400 text-white font-black text-xs sm:text-sm rounded-xl shadow-xl cursor-pointer flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Jugar Otro Intento</span>
                </button>

                <button
                  onClick={() => setActiveView('leaderboard')}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer flex items-center gap-2"
                >
                  <Trophy className="w-4 h-4 text-gold" />
                  <span>Ver Tabla de Clasificación</span>
                </button>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
