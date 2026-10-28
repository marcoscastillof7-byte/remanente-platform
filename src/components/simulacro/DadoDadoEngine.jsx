import { useState, useEffect, useRef } from 'react';
import { 
  Dices, Clock, Shield, AlertTriangle, CheckCircle2, XCircle, ArrowRight, 
  Award, Volume2, Sparkles, User, Users, Trophy, RotateCcw, Play, Star
} from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';

// 6 Temáticas oficiales de las 6 caras del dado
const DADO_THEMES = [
  { face: 1, name: 'Reyes y Conquistadores', color: '#3b82f6', bg: 'bg-blue-600', border: 'border-blue-500', icon: '👑' },
  { face: 2, name: 'Profetas de Dios', color: '#10b981', bg: 'bg-emerald-600', border: 'border-emerald-500', icon: '📜' },
  { face: 3, name: 'Batallas y Estrategias', color: '#ef4444', bg: 'bg-red-600', border: 'border-red-500', icon: '⚔️' },
  { face: 4, name: 'Milagros y Señales', color: '#8b5cf6', bg: 'bg-purple-600', border: 'border-purple-500', icon: '✨' },
  { face: 5, name: 'Sabiduría y Ley', color: '#f59e0b', bg: 'bg-amber-600', border: 'border-amber-500', icon: '⚖️' },
  { face: 6, name: 'Desafío de Oro (Pregunta Crucial)', color: '#eab308', bg: 'bg-yellow-500', border: 'border-yellow-400', icon: '🏆' }
];

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

    if (type === 'roll') {
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          try {
            const subOsc = ctx.createOscillator();
            const subGain = ctx.createGain();
            subOsc.type = 'triangle';
            subOsc.frequency.setValueAtTime(220 + Math.random() * 320, ctx.currentTime);
            subGain.gain.setValueAtTime(0.15, ctx.currentTime);
            subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
            subOsc.connect(subGain);
            subGain.connect(ctx.destination);
            subOsc.start();
            subOsc.stop(ctx.currentTime + 0.05);
          } catch (e) {}
        }, i * 60);
      }
    } else if (type === 'tick') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } else if (type === 'timeout') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } else if (type === 'correct') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {}
};

export default function DadoDadoEngine({ 
  finalistPlayers = [],
  finalistTeams = [], 
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

  // Lista de participantes para la tabla comparativa de posiciones
  const effectivePlayers = (Array.isArray(finalistPlayers) && finalistPlayers.length > 0)
    ? finalistPlayers
    : ((Array.isArray(finalistTeams) && finalistTeams.length > 0) ? finalistTeams : [
        { id: activePlayer.id, username: activePlayer.username, points: activePlayer.points, badge: '👑' }
      ]);

  // Vista activa: 'player' (Apartado Individual del Dado) | 'leaderboard' (Tabla de Rendimiento de El Dado Dado)
  const [activeView, setActiveView] = useState('player');

  // Récords individuales de El Dado Dado: playerId -> { bestScore, runs: [...] }
  const [playerRecords, setPlayerRecords] = useState(() => {
    try {
      const saved = localStorage.getItem('simulacro_dado_player_records');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('simulacro_dado_player_records', JSON.stringify(playerRecords));
    } catch (e) {}
  }, [playerRecords]);

  // Tanda oficial de 8 lanzamientos por jugador
  const TOTAL_ROLLS = 8;
  const [rollIndex, setRollIndex] = useState(0); // 0 a 7
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [roundFinished, setRoundFinished] = useState(false);
  const [rollHistory, setRollHistory] = useState([]);
  const [wisdomAwarded, setWisdomAwarded] = useState(null);

  // Estado del dado
  const [isRolling, setIsRolling] = useState(false);
  const [diceFace, setDiceFace] = useState(1);
  const [diceRotation, setDiceRotation] = useState({ x: 0, y: 0, z: 0 });
  const [hasRolled, setHasRolled] = useState(false);

  // Estado de la pregunta actual
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [answeredState, setAnsweredState] = useState(null); // 'correct' | 'incorrect' | 'timeout'
  const [selectedOptKey, setSelectedOptKey] = useState(null);

  const timerRef = useRef(null);

  // Cuenta regresiva automática de 30 segundos
  useEffect(() => {
    if (timerActive && timeLeft > 0 && !roundFinished) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleTimeout();
            return 0;
          }
          if (prev <= 6) {
            playTone('tick');
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, timeLeft, roundFinished]);

  // Lanzar el Dado
  const handleRollDice = async () => {
    if (isRolling || hasRolled || roundFinished) return;

    setIsRolling(true);
    setHasRolled(false);
    setCurrentQuestion(null);
    setTimerActive(false);
    setAnsweredState(null);
    setSelectedOptKey(null);
    setTimeLeft(30);
    setWisdomAwarded(null);

    playTone('roll');

    // Cara aleatoria 1 a 6
    const chosenFace = Math.floor(Math.random() * 6) + 1;

    // Rotación 3D del dado
    const extraRotations = 5;
    const baseRotations = {
      1: { x: 0, y: 0 },
      2: { x: 0, y: -90 },
      3: { x: -90, y: 0 },
      4: { x: 90, y: 0 },
      5: { x: 0, y: 90 },
      6: { x: 0, y: 180 }
    };

    const targetRot = baseRotations[chosenFace];
    setDiceRotation({
      x: targetRot.x + (extraRotations * 360),
      y: targetRot.y + (extraRotations * 360),
      z: 0
    });

    // Cargar la pregunta correspondiente a la temática del dado
    setLoadingQuestion(true);
    let loadedQ = null;
    try {
      const usedIds = rollHistory.map(r => r.questionId).filter(Boolean).join(',');
      const res = await api.get(`/simulacro/questions/dado?face=${chosenFace}&exclude=${encodeURIComponent(usedIds)}`);
      if (res && res.question) {
        loadedQ = {
          ...res.question,
          themeName: res.themeName,
          face: chosenFace
        };
        setCurrentQuestion(loadedQ);
      }
    } catch (err) {
      console.error('Error cargando pregunta de dado:', err);
    } finally {
      setLoadingQuestion(false);
    }

    // Tras el giro físico (1.2s), se revela la categoría e INICIA AUTOMÁTICAMENTE EL TIMER DE 30s
    setTimeout(() => {
      setIsRolling(false);
      setDiceFace(chosenFace);
      setHasRolled(true);

      // Iniciar automáticamente los 30 segundos
      setTimerActive(true);
      setTimeLeft(30);
    }, 1200);
  };

  // Tiempo agotado (0 puntos)
  const handleTimeout = () => {
    setTimerActive(false);
    setAnsweredState('timeout');
    playTone('timeout');
    recordHistory('timeout', 0);
  };

  // Responder a la pregunta
  const handleAnswer = (optionKey) => {
    if (!timerActive || answeredState || !currentQuestion) return;

    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);
    setSelectedOptKey(optionKey);

    const isCorrect = optionKey.toLowerCase() === (currentQuestion.correct_answer || 'a').toLowerCase();

    if (isCorrect) {
      setAnsweredState('correct');
      playTone('correct');
      setScore(prev => prev + 10);
      setCorrectCount(prev => prev + 1);
      recordHistory('correct', 10);
    } else {
      setAnsweredState('incorrect');
      playTone('wrong');
      recordHistory('incorrect', 0);
    }
  };

  // Registrar resultado en historial de la tanda
  const recordHistory = (result, points) => {
    const entry = {
      roll: rollIndex + 1,
      face: diceFace,
      questionId: currentQuestion?.id,
      themeName: DADO_THEMES.find(t => t.face === diceFace)?.name || 'Temática Bíblica',
      result,
      points
    };
    setRollHistory(prev => [...prev, entry]);
  };

  // Pasar al siguiente lanzamiento o finalizar la tanda de 8
  const handleNextRoll = () => {
    if (rollIndex < TOTAL_ROLLS - 1) {
      setRollIndex(prev => prev + 1);
      setHasRolled(false);
      setCurrentQuestion(null);
      setTimerActive(false);
      setAnsweredState(null);
      setSelectedOptKey(null);
      setTimeLeft(30);
    } else {
      handleFinishRound();
    }
  };

  // Finalizar tanda de 8 lanzamientos
  const handleFinishRound = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRoundFinished(true);
    setTimerActive(false);

    // Guardar récord del jugador
    setScore(finalScore => {
      // Transferir puntos ganados a la cuenta del usuario como Puntos de Sabiduría en Supabase
      if (finalScore > 0 && currentUser?.id) {
        api.post('/simulacro/points/award', {
          competition: 'dado',
          score: finalScore,
          details: { correctCount, totalRolls: TOTAL_ROLLS }
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
              date: new Date().toISOString()
            }, ...(existing.runs || [])].slice(0, 10)
          }
        };
      });
      return finalScore;
    });
  };

  // Clasificación de El Dado Dado
  const sortedLeaderboard = effectivePlayers.map(p => {
    const rec = playerRecords[String(p.id)];
    return {
      player: p,
      bestScore: rec ? rec.bestScore : 0,
      totalRuns: rec ? rec.totalRuns : 0
    };
  }).sort((a, b) => b.bestScore - a.bestScore);

  // Avanzar a Fase 4 (La Ruleta)
  const handleAdvanceToPhase4 = () => {
    if (onCompletePhase) {
      const scoresMap = {};
      effectivePlayers.forEach(p => {
        scoresMap[p.id] = playerRecords[String(p.id)]?.bestScore || 0;
      });

      onCompletePhase({
        phase: 'dado',
        dadoScores: scoresMap,
        finalistPlayers: sortedLeaderboard.slice(0, 2).map(e => e.player)
      });
    }
  };

  const activeTheme = DADO_THEMES.find(t => t.face === diceFace) || DADO_THEMES[0];
  const activeRecord = playerRecords[String(activePlayer.id)];

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* HEADER DE LA SECCIÓN */}
      <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-yellow-950/80 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-500 to-amber-600 flex items-center justify-center text-3xl shadow-lg shadow-amber-500/30 text-slate-950 font-black">
            🎲
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                Fase 3 • Desafío Individual
              </span>
              <span className="text-xs text-slate-400 font-mono">8 Lanzamientos • Timer Automático 30s</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-serif text-white tracking-wide mt-0.5">
              El Dado Dado: Temáticas Bíblicas
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
            <span>{activeView === 'leaderboard' ? 'Volver a Mis Tiradas' : '🏆 Tabla de Posiciones'}</span>
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

      {/* VISTA 1: TABLA GENERAL DE POSICIONES */}
      {activeView === 'leaderboard' ? (
        <div className="bg-slate-900/90 border border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-gold" />
                <span>Clasificación Oficial • El Dado Dado</span>
              </span>
              <h2 className="text-2xl font-black font-serif text-white mt-1">
                Tabla de Posiciones de El Dado Dado
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Rendimiento de los participantes registrados. Cada quien compite exclusivamente para su cuenta personal.
              </p>
            </div>

            <button
              onClick={handleAdvanceToPhase4}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-xl flex items-center gap-2 cursor-pointer uppercase tracking-wider shrink-0"
            >
              <span>Avanzar a Fase 4: La Ruleta</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {sortedLeaderboard.map((item, idx) => {
              const isMe = String(item.player.id) === String(activePlayer.id);

              return (
                <div
                  key={item.player.id}
                  className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                    isMe
                      ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-500 shadow-xl'
                      : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-black text-xs ${
                      idx === 0 ? 'bg-gradient-to-tr from-yellow-400 to-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {idx + 1}º
                    </span>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-600 flex items-center justify-center text-slate-950 font-black text-sm shadow">
                        {(item.player.username || item.player.name || 'J').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm sm:text-base">
                            {item.player.username || item.player.name}
                          </span>
                          {isMe && (
                            <span className="text-[10px] font-black uppercase bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full shadow">
                              ⭐ Tu Cuenta
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {item.totalRuns} {item.totalRuns === 1 ? 'tanda completada' : 'tandas completadas'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <span className="text-xl sm:text-2xl font-black font-mono text-amber-400 block">
                        {item.bestScore} / 80 <span className="text-xs text-slate-400 font-normal">pts</span>
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

          {/* PERFIL DEL JUGADOR Y MARCADOR */}
          <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-yellow-950/40 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 text-xl font-black shadow-lg border border-amber-300">
                {(activePlayer.username || activePlayer.name || 'J').substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    Tu Cuenta Personal
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Tirada {roundFinished ? 8 : rollIndex + 1} de {TOTAL_ROLLS}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white font-serif mt-0.5">
                  {activePlayer.username || activePlayer.name}
                </h2>
              </div>
            </div>

            {/* Puntuación de la Ronda */}
            <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl w-full md:w-auto justify-between md:justify-start">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Puntuación Actual</span>
                <span className="text-2xl font-black font-mono text-amber-400">
                  {score} / 80 <span className="text-xs text-slate-400 font-normal">pts</span>
                </span>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Récord Personal</span>
                <span className="text-base font-bold font-mono text-slate-200">
                  {activeRecord?.bestScore || 0} pts
                </span>
              </div>
            </div>
          </div>

          {/* DADO 3D ANIMADO Y TEMÁTICAS */}
          {!roundFinished && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                
                {/* Lado Izquierdo: Leyenda de las 6 Caras */}
                <div className="space-y-1.5 order-2 md:order-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">6 Caras Temáticas:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-1 gap-1.5 text-xs">
                    {DADO_THEMES.map(theme => (
                      <div 
                        key={theme.face}
                        className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${
                          hasRolled && diceFace === theme.face 
                            ? 'bg-amber-500/20 border-amber-400 text-white font-bold ring-1 ring-amber-400' 
                            : 'bg-slate-950/60 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-md bg-slate-900 flex items-center justify-center font-mono font-bold text-[11px] shrink-0">
                          {theme.face}
                        </span>
                        <span className="truncate">{theme.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Centro: Animación 3D del Dado */}
                <div className="flex flex-col items-center justify-center py-4 order-1 md:order-2">
                  <div className="w-36 h-36 relative perspective-1000 flex items-center justify-center">
                    <div 
                      className={`w-28 h-28 relative transform-style-3d transition-transform duration-1000 ease-out ${
                        isRolling ? 'animate-spin' : ''
                      }`}
                      style={{
                        transform: `rotateX(${diceRotation.x}deg) rotateY(${diceRotation.y}deg) rotateZ(${diceRotation.z}deg)`
                      }}
                    >
                      {/* Cara 1 */}
                      <div className="absolute w-28 h-28 bg-gradient-to-tr from-blue-700 to-indigo-600 border-2 border-blue-400 rounded-2xl flex flex-col items-center justify-center text-white shadow-2xl transform translate-z-14">
                        <span className="text-3xl">👑</span>
                        <span className="text-[10px] font-black uppercase mt-1">Cara 1</span>
                      </div>
                      {/* Cara 2 */}
                      <div className="absolute w-28 h-28 bg-gradient-to-tr from-emerald-700 to-teal-600 border-2 border-emerald-400 rounded-2xl flex flex-col items-center justify-center text-white shadow-2xl transform rotate-y-90 translate-z-14">
                        <span className="text-3xl">📜</span>
                        <span className="text-[10px] font-black uppercase mt-1">Cara 2</span>
                      </div>
                      {/* Cara 3 */}
                      <div className="absolute w-28 h-28 bg-gradient-to-tr from-red-700 to-rose-600 border-2 border-red-400 rounded-2xl flex flex-col items-center justify-center text-white shadow-2xl transform rotate-x-90 translate-z-14">
                        <span className="text-3xl">⚔️</span>
                        <span className="text-[10px] font-black uppercase mt-1">Cara 3</span>
                      </div>
                      {/* Cara 4 */}
                      <div className="absolute w-28 h-28 bg-gradient-to-tr from-purple-700 to-pink-600 border-2 border-purple-400 rounded-2xl flex flex-col items-center justify-center text-white shadow-2xl transform -rotate-x-90 translate-z-14">
                        <span className="text-3xl">✨</span>
                        <span className="text-[10px] font-black uppercase mt-1">Cara 4</span>
                      </div>
                      {/* Cara 5 */}
                      <div className="absolute w-28 h-28 bg-gradient-to-tr from-amber-600 to-yellow-600 border-2 border-amber-400 rounded-2xl flex flex-col items-center justify-center text-slate-950 shadow-2xl transform -rotate-y-90 translate-z-14">
                        <span className="text-3xl">⚖️</span>
                        <span className="text-[10px] font-black uppercase mt-1">Cara 5</span>
                      </div>
                      {/* Cara 6 */}
                      <div className="absolute w-28 h-28 bg-gradient-to-tr from-yellow-400 via-amber-500 to-yellow-500 border-2 border-yellow-300 rounded-2xl flex flex-col items-center justify-center text-slate-950 shadow-2xl transform rotate-y-180 translate-z-14">
                        <span className="text-3xl">🏆</span>
                        <span className="text-[10px] font-black uppercase mt-1">Cara 6</span>
                      </div>
                    </div>
                  </div>

                  {/* Botón Lanzar Dado */}
                  {!hasRolled && !isRolling && (
                    <button
                      onClick={handleRollDice}
                      className="mt-6 px-8 py-3 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm rounded-xl shadow-xl transition transform hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
                    >
                      <Dices className="w-5 h-5" />
                      <span>Lanzar el Dado (Tirada {rollIndex + 1})</span>
                    </button>
                  )}
                </div>

                {/* Lado Derecho: Estado del Lanzamiento */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-2 order-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Temática Otorgada:</span>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-2xl block">{activeTheme.icon}</span>
                    <h4 className="text-sm font-bold text-white mt-1">{activeTheme.name}</h4>
                    <p className="text-[11px] text-amber-400 font-mono mt-0.5">Cara {activeTheme.face} del Dado</p>
                  </div>
                  {hasRolled && (
                    <span className="text-[11px] text-emerald-400 font-bold block animate-pulse">
                      ⏱️ Temporizador de 30s iniciado automáticamente
                    </span>
                  )}
                </div>

              </div>

              {/* PREGUNTA Y TIMER AUTOMÁTICO DE 30 SEGUNDOS */}
              {hasRolled && currentQuestion && (
                <div className="space-y-4 pt-4 border-t border-slate-800 animate-fadeIn">
                  
                  {/* Barra de tiempo de 30s */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl flex items-center gap-2 border ${
                        timeLeft <= 6 ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' : 'bg-amber-500/20 border-amber-500 text-amber-400'
                      }`}>
                        <Clock className="w-4 h-4 animate-spin" />
                        <span className="text-xl font-black font-mono">{timeLeft}s</span>
                      </div>
                      <span className="text-xs text-slate-300 font-semibold">{currentQuestion.themeName}</span>
                    </div>

                    {currentQuestion.verse_reference && (
                      <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-xs font-mono text-slate-400">
                        📖 {currentQuestion.verse_reference}
                      </span>
                    )}
                  </div>

                  {/* Enunciado */}
                  <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800">
                    <h3 className="text-lg sm:text-xl font-bold text-white leading-relaxed">
                      {currentQuestion.question_text}
                    </h3>
                  </div>

                  {/* 4 Opciones */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['a', 'b', 'c', 'd'].map(optKey => {
                      const optText = currentQuestion[`option_${optKey}`];
                      if (!optText) return null;

                      const isCorrect = (currentQuestion.correct_answer || 'a').toLowerCase() === optKey;
                      const isSelected = selectedOptKey === optKey;

                      let btnStyle = 'bg-slate-950/80 border-slate-800 text-slate-200 hover:border-amber-400 hover:bg-slate-800/60';
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
                      }

                      return (
                        <button
                          key={optKey}
                          onClick={() => handleAnswer(optKey)}
                          disabled={!timerActive || answeredState !== null}
                          className={`p-4 rounded-2xl border-2 text-left transition-all duration-150 flex items-start gap-3 cursor-pointer ${btnStyle}`}
                        >
                          <span className={`w-7 h-7 rounded-lg border flex items-center justify-center font-mono font-bold text-xs uppercase shrink-0 ${
                            answeredState && isCorrect
                              ? 'bg-emerald-800 border-emerald-400 text-white font-black'
                              : answeredState && isSelected && !isCorrect
                              ? 'bg-red-900 border-red-400 text-white font-black'
                              : 'bg-slate-900 border-slate-700 text-slate-300'
                          }`}>
                            {optKey}
                          </span>
                          <span className="text-sm font-medium leading-snug pt-0.5 flex-1">
                            {optText}
                          </span>
                          {badge}
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback y Botón Siguiente Tirada */}
                  {answeredState && (
                    <div className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn ${
                      answeredState === 'correct' 
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200' 
                        : 'bg-red-950/60 border-red-500 text-red-200'
                    }`}>
                      <div className="flex items-start gap-3">
                        {answeredState === 'correct' ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <h4 className="text-base font-black">
                            {answeredState === 'correct' ? '¡Respuesta Correcta! (+10 pts)' : answeredState === 'timeout' ? '¡Tiempo Agotado! (0 pts)' : '¡Respuesta Incorrecta! (0 pts)'}
                          </h4>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs bg-slate-950/90 px-2.5 py-1 rounded-lg border border-slate-700 font-bold text-white">
                              Respuesta correcta: <strong className="text-emerald-400 uppercase">{(currentQuestion.correct_answer || 'a')})</strong> {currentQuestion[`option_${(currentQuestion.correct_answer || 'a').toLowerCase()}`]}
                            </span>
                          </div>
                          {currentQuestion.explanation && (
                            <p className="text-xs text-slate-300 mt-1 italic">
                              💡 {currentQuestion.explanation}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={handleNextRoll}
                        className="w-full sm:w-auto px-6 py-2.5 bg-white text-slate-950 hover:bg-slate-200 font-black text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                      >
                        <span>{rollIndex >= TOTAL_ROLLS - 1 ? 'Ver Resultado Final' : 'Siguiente Tirada'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                </div>
              )}

            </div>
          )}

          {/* ESTADO 3: TANDA DE 8 LANZAMIENTOS COMPLETADA */}
          {roundFinished && (
            <div className="bg-slate-900/90 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center mx-auto text-3xl shadow-xl shadow-amber-500/30">
                <Trophy className="w-8 h-8 text-slate-950 animate-bounce" />
              </div>

              <div className="space-y-1">
                <span className="text-xs uppercase font-extrabold text-amber-400 tracking-widest font-mono">
                  ¡8 Lanzamientos Completados!
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-serif text-white">
                  {activePlayer.username || activePlayer.name} obtuvo <span className="text-amber-400 font-mono">{score} / 80 puntos</span>
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto pt-1">
                  Tu puntuación en El Dado Dado queda registrada y se sumará a La Ruleta para la Gran Final.
                </p>
              </div>

              {/* Banner de Puntos de Sabiduría Acreditados */}
              {wisdomAwarded && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-amber-500/25 to-emerald-500/20 border-2 border-amber-400/80 shadow-xl max-w-md mx-auto space-y-1">
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

              {/* Historial de Tiradas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-xl mx-auto">
                {rollHistory.map((item, i) => (
                  <div key={i} className={`p-2.5 rounded-xl border text-xs text-left ${
                    item.result === 'correct' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-red-950/40 border-red-500/30 text-red-300'
                  }`}>
                    <div className="flex justify-between font-mono font-bold">
                      <span>Tirada {item.roll}</span>
                      <span>+{item.points} pts</span>
                    </div>
                    <span className="text-[10px] text-slate-400 truncate block mt-0.5">{item.themeName}</span>
                  </div>
                ))}
              </div>

              {/* Botones de Acción */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setRoundFinished(false);
                    setRollIndex(0);
                    setScore(0);
                    setCorrectCount(0);
                    setRollHistory([]);
                    setHasRolled(false);
                    setCurrentQuestion(null);
                    setWisdomAwarded(null);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-xl cursor-pointer flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Jugar Otra Tanda de 8</span>
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
