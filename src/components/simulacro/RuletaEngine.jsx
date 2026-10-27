import { useState, useEffect, useRef } from 'react';
import { 
  Disc, Clock, Shield, AlertTriangle, CheckCircle2, XCircle, Trophy, 
  Sparkles, Award, ArrowRight, RotateCw, Star, User, Users, RotateCcw, Play 
} from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import confetti from 'canvas-confetti';

// 8 Sectores oficiales de La Ruleta Bíblica
const RULETA_SECTORS = [
  { index: 1, name: '1 Samuel: El Llamado y Saúl', shortName: '1 Sam: Saúl', color: '#3b82f6', textColor: '#ffffff', icon: '👑' },
  { index: 2, name: '1 Samuel: David y Goliat', shortName: '1 Sam: David', color: '#10b981', textColor: '#ffffff', icon: '⚔️' },
  { index: 3, name: '2 Samuel: El Reino de David', shortName: '2 Sam: Reino', color: '#f59e0b', textColor: '#ffffff', icon: '🏰' },
  { index: 4, name: '2 Samuel: Valientes y Victorias', shortName: '2 Sam: Valientes', color: '#8b5cf6', textColor: '#ffffff', icon: '🛡️' },
  { index: 5, name: '1 Reyes: El Templo de Salomón', shortName: '1 Rey: Templo', color: '#ec4899', textColor: '#ffffff', icon: '🏛️' },
  { index: 6, name: '1 Reyes: Elías en el Carmelo', shortName: '1 Rey: Elías', color: '#ef4444', textColor: '#ffffff', icon: '🔥' },
  { index: 7, name: '2 Reyes: Eliseo y sus Milagros', shortName: '2 Rey: Eliseo', color: '#06b6d4', textColor: '#ffffff', icon: '✨' },
  { index: 8, name: '2 Reyes: Reyes de Judá e Israel', shortName: '2 Rey: Reyes', color: '#eab308', textColor: '#000000', icon: '📜' }
];

// Audio sintetizado
const playWheelSound = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'tick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } else if (type === 'correct') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'wrong') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'fanfare') {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
          } catch (e) {}
        }, idx * 120);
      });
    }
  } catch (e) {}
};

export default function RuletaEngine({ 
  finalistPlayers = [],
  finalistTeams = [], 
  dadoScores = {}, 
  onCompleteTournament, 
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

  // Vista activa: 'player' (Apartado Individual) | 'leaderboard' (Tabla de Clasificación)
  const [activeView, setActiveView] = useState('player');

  // Récords individuales de La Ruleta: playerId -> { bestScore, runs: [...] }
  const [playerRecords, setPlayerRecords] = useState(() => {
    try {
      const saved = localStorage.getItem('simulacro_ruleta_player_records');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('simulacro_ruleta_player_records', JSON.stringify(playerRecords));
    } catch (e) {}
  }, [playerRecords]);

  // Obtener puntos de El Dado Dado de un jugador
  const getPlayerDadoScore = (playerId) => {
    if (dadoScores && dadoScores[playerId] !== undefined) {
      return dadoScores[playerId];
    }
    try {
      const dadoRecords = JSON.parse(localStorage.getItem('simulacro_dado_player_records') || '{}');
      if (dadoRecords[String(playerId)]?.bestScore !== undefined) {
        return dadoRecords[String(playerId)].bestScore;
      }
    } catch (e) {}
    return 0;
  };

  // Tanda oficial de 8 giros por jugador
  const TOTAL_SPINS = 8;
  const [spinIndex, setSpinIndex] = useState(0); // 0 a 7
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [roundFinished, setRoundFinished] = useState(false);
  const [spinHistory, setSpinHistory] = useState([]);
  const [wisdomAwarded, setWisdomAwarded] = useState(null);

  // Estado del giro
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [selectedSector, setSelectedSector] = useState(null);
  const [hasSpun, setHasSpun] = useState(false);

  // Estado de la pregunta
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [answeredState, setAnsweredState] = useState(null); // 'correct' | 'incorrect' | 'timeout'
  const [selectedOptKey, setSelectedOptKey] = useState(null);

  const timerRef = useRef(null);

  // Temporizador de 30 segundos automático
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
            playWheelSound('tick');
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, timeLeft, roundFinished]);

  // Confeti al terminar la ronda
  useEffect(() => {
    if (roundFinished) {
      playWheelSound('fanfare');
      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}
    }
  }, [roundFinished]);

  // Girar la ruleta
  const handleSpinWheel = async () => {
    if (isSpinning || hasSpun || roundFinished) return;

    setIsSpinning(true);
    setHasSpun(false);
    setSelectedSector(null);
    setCurrentQuestion(null);
    setTimerActive(false);
    setAnsweredState(null);
    setSelectedOptKey(null);
    setTimeLeft(30);
    setWisdomAwarded(null);

    // Seleccionar sector ganador aleatorio (1 a 8)
    const targetSectorIndex = Math.floor(Math.random() * 8) + 1;
    const sectorObj = RULETA_SECTORS.find(s => s.index === targetSectorIndex);

    const sectorAngle = 45;
    const targetSectorCenter = (targetSectorIndex - 1) * sectorAngle + (sectorAngle / 2);
    const randomVueltas = 5 + Math.floor(Math.random() * 3);
    const finalAngle = (randomVueltas * 360) + (360 - targetSectorCenter) + 90;

    setWheelRotation(prev => prev + finalAngle);

    const spinTicks = setInterval(() => {
      playWheelSound('tick');
    }, 150);

    // Cargar la pregunta en paralelo
    setLoadingQuestion(true);
    try {
      const usedIds = spinHistory.map(s => s.questionId).filter(Boolean).join(',');
      const res = await api.get(`/simulacro/questions/ruleta?sector=${targetSectorIndex}&exclude=${encodeURIComponent(usedIds)}`);
      if (res && res.question) {
        setCurrentQuestion({
          ...res.question,
          sectorName: res.sectorName || sectorObj.name,
          sectorIndex: targetSectorIndex
        });
      }
    } catch (err) {
      console.error('Error cargando pregunta de ruleta:', err);
    } finally {
      setLoadingQuestion(false);
    }

    // DINAMISMO AUTOMÁTICO: Al detenerse la ruleta (3.2s), se revela el sector y el reloj de 30s INICIA AUTOMÁTICAMENTE
    setTimeout(() => {
      clearInterval(spinTicks);
      setIsSpinning(false);
      setSelectedSector(sectorObj);
      setHasSpun(true);

      // Iniciar el reloj de 30 segundos automáticamente
      setTimerActive(true);
      setTimeLeft(30);
    }, 3200);
  };

  // Tiempo agotado (pregunta anulada por reglamento)
  const handleTimeout = () => {
    setTimerActive(false);
    setAnsweredState('timeout');
    playWheelSound('wrong');
    recordSpinResult('timeout', 0);
  };

  // Evaluar respuesta
  const handleAnswer = (optionKey) => {
    if (!timerActive || answeredState || !currentQuestion) return;

    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);
    setSelectedOptKey(optionKey);

    const isCorrect = optionKey.toLowerCase() === (currentQuestion.correct_answer || 'a').toLowerCase();

    if (isCorrect) {
      setAnsweredState('correct');
      playWheelSound('correct');
      setScore(prev => prev + 10);
      setCorrectCount(prev => prev + 1);
      recordSpinResult('correct', 10);
    } else {
      setAnsweredState('incorrect');
      playWheelSound('wrong');
      recordSpinResult('incorrect', 0);
    }
  };

  // Guardar en historial de giros
  const recordSpinResult = (result, points) => {
    const entry = {
      spin: spinIndex + 1,
      questionId: currentQuestion?.id,
      sectorName: selectedSector?.name || 'Sector Bíblico',
      sectorIcon: selectedSector?.icon || '📜',
      result,
      points
    };
    setSpinHistory(prev => [...prev, entry]);
  };

  // Siguiente giro o finalizar tanda de 8
  const handleNextSpin = () => {
    if (spinIndex < TOTAL_SPINS - 1) {
      setSpinIndex(prev => prev + 1);
      setHasSpun(false);
      setIsSpinning(false);
      setSelectedSector(null);
      setCurrentQuestion(null);
      setTimerActive(false);
      setAnsweredState(null);
      setSelectedOptKey(null);
      setTimeLeft(30);
    } else {
      handleFinishRound();
    }
  };

  // Finalizar tanda de 8 giros
  const handleFinishRound = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRoundFinished(true);
    setTimerActive(false);

    // Guardar récord del jugador
    setScore(finalScore => {
      // Transferir puntos ganados a la cuenta del usuario como Puntos de Sabiduría en Supabase
      if (finalScore > 0 && currentUser?.id) {
        api.post('/simulacro/points/award', {
          competition: 'ruleta',
          score: finalScore,
          details: { correctCount, totalSpins: TOTAL_SPINS }
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

  // Clasificación combinada de todos los jugadores (Dado + Ruleta)
  const sortedLeaderboard = effectivePlayers.map(p => {
    const recRuleta = playerRecords[String(p.id)];
    const ruletaScore = recRuleta ? recRuleta.bestScore : 0;
    const dadoScore = getPlayerDadoScore(p.id);
    const combinedTotal = ruletaScore + dadoScore;

    return {
      player: p,
      ruletaScore,
      dadoScore,
      combinedTotal,
      runsCount: recRuleta ? recRuleta.totalRuns : 0
    };
  }).sort((a, b) => b.combinedTotal - a.combinedTotal || b.ruletaScore - a.ruletaScore);

  const activePlayerDado = getPlayerDadoScore(activePlayer.id);
  const activePlayerCombined = score + activePlayerDado;
  const activePlayerBestRuleta = playerRecords[String(activePlayer.id)]?.bestScore || 0;

  return (
    <div className="space-y-6">

      {/* Encabezado Oficial Categoría 4: La Ruleta */}
      <div className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 border border-purple-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/20 border border-purple-500/40 rounded-2xl text-purple-400">
            <Disc className="w-8 h-8 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest font-bold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                Fase 4 • Modalidad Individual
              </span>
              <span className="text-xs text-slate-400 font-medium">8 Giros por jugador • Reloj automático de 30s</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-white tracking-wide mt-0.5">
              Categoría 4: La Ruleta Bíblica
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView(prev => prev === 'player' ? 'leaderboard' : 'player')}
            className={`px-4 py-2 border rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeView === 'leaderboard'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold'
                : 'bg-slate-800/80 hover:bg-slate-700 text-amber-300 border-amber-500/30'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>{activeView === 'leaderboard' ? 'Volver a Mis Giros' : 'Tabla de Clasificación'}</span>
          </button>

          <button
            onClick={() => onOpenDisciplinary && onOpenDisciplinary(activePlayer)}
            className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <Shield className="w-4 h-4 text-red-400" />
            <span>Arbitraje</span>
          </button>
        </div>
      </div>

      {/* VISTA 1: TABLA DE CLASIFICACIÓN / POSICIONES */}
      {activeView === 'leaderboard' ? (
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/40">
                <Trophy className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold font-serif text-white">Tabla de Honor: La Ruleta y Gran Final</h3>
                <p className="text-xs text-slate-400">
                  Rendimiento de los participantes registrados. Cada quien compite exclusivamente para su cuenta personal.
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveView('player')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>Volver a Mis Giros</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                  <th className="py-3 px-4">Posición</th>
                  <th className="py-3 px-4">Participante</th>
                  <th className="py-3 px-4 text-center">Récord Ruleta</th>
                  <th className="py-3 px-4 text-center">Fase 3: El Dado Dado</th>
                  <th className="py-3 px-4 text-center">TOTAL COMBINADO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {sortedLeaderboard.map((item, idx) => {
                  const isCurrent = String(item.player.id) === String(activePlayer.id);
                  return (
                    <tr 
                      key={item.player.id} 
                      className={`hover:bg-slate-800/40 transition ${
                        isCurrent ? 'bg-purple-950/40 font-semibold' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono">
                        {idx === 0 ? '🥇 1º Puesto' : idx === 1 ? '🥈 2º Puesto' : idx === 2 ? '🥉 3º Puesto' : `${idx + 1}º`}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-bold text-white border border-slate-700">
                            {(item.player.username || item.player.name || 'J').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-bold block">{item.player.username || item.player.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-black uppercase bg-purple-500 text-white px-2 py-0.5 rounded-full shadow">
                                  ⭐ Tu Cuenta
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {item.runsCount > 0 ? `${item.runsCount} tanda(s) jugada(s)` : 'Sin tandas jugadas'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-purple-400">
                        {item.ruletaScore} pts
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-emerald-400 font-semibold">
                        {item.dadoScore} pts
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-black text-amber-400 text-base">
                        {item.combinedTotal} pts
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISTA 2: APARTADO INDIVIDUAL DEL JUGADOR ACTIVO */
        <div className="space-y-6">

          {/* Marcador en Vivo del Jugador */}
          <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/30 rounded-3xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-lg font-black shadow-md border border-purple-400/30">
                  {(activePlayer.username || activePlayer.name || 'J').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                      Tu Cuenta Personal
                    </span>
                    <span className="text-xs text-slate-400">Récord Ruleta: <strong className="text-purple-300 font-mono">{activePlayerBestRuleta} pts</strong></span>
                  </div>
                  <h3 className="text-xl font-black text-white font-serif mt-0.5">
                    {activePlayer.username || activePlayer.name}
                  </h3>
                </div>
              </div>

              {/* Puntajes Combinados */}
              <div className="flex items-center gap-4 sm:gap-6 bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-slate-800">
                <div className="text-center">
                  <span className="text-[10px] uppercase font-bold text-purple-400 block">Ruleta (Esta Tanda)</span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-purple-300">{score}</span>
                </div>
                <div className="text-slate-600 text-lg font-bold">+</div>
                <div className="text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block">El Dado Dado</span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-emerald-300">{activePlayerDado}</span>
                </div>
                <div className="text-slate-600 text-lg font-bold">=</div>
                <div className="text-center">
                  <span className="text-[10px] uppercase font-bold text-amber-400 block">TOTAL COMBINADO</span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-amber-300">{activePlayerCombined}</span>
                </div>
              </div>
            </div>

            {/* Barra de progreso de giros (1 a 8) */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">
                Giro {roundFinished ? 8 : (hasSpun ? spinIndex + 1 : spinIndex)} de {TOTAL_SPINS}
              </span>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: TOTAL_SPINS }).map((_, i) => {
                  const isDone = i < spinIndex || roundFinished;
                  const isCurrent = i === spinIndex && !roundFinished;
                  return (
                    <div
                      key={i}
                      className={`h-2 rounded-full transition-all ${
                        isDone 
                          ? 'w-6 bg-purple-500' 
                          : isCurrent 
                          ? 'w-8 bg-amber-400 animate-pulse' 
                          : 'w-4 bg-slate-800'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* ÁREA DE JUEGO PRINCIPAL DE LA RULETA */}
          {!roundFinished ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Columna Izquierda: Ruleta Animada SVG (5 columnas) */}
              <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col items-center justify-between text-center space-y-6">
                <div className="w-full flex items-center justify-between text-xs text-slate-400">
                  <span>Giro #{spinIndex + 1} de {TOTAL_SPINS}</span>
                  <span className="font-mono text-purple-400 font-bold">10 pts por acierto</span>
                </div>

                {/* Ruleta Gráfica */}
                <div className="relative flex flex-col items-center justify-center py-2">
                  <div className="absolute top-0 z-20 -mt-2 filter drop-shadow-lg">
                    <div className="w-0 h-0 border-x-8 border-x-transparent border-t-[20px] border-t-amber-400"></div>
                  </div>

                  <div 
                    className="w-56 h-56 sm:w-64 sm:h-64 relative rounded-full shadow-2xl transition-transform ease-out cursor-pointer"
                    style={{
                      transform: `rotate(${wheelRotation}deg)`,
                      transitionDuration: isSpinning ? '3.2s' : '0s'
                    }}
                    onClick={handleSpinWheel}
                  >
                    <svg viewBox="0 0 200 200" className="w-full h-full rounded-full">
                      {RULETA_SECTORS.map((sector, i) => {
                        const angle = 45;
                        const startAngle = i * angle;
                        const endAngle = startAngle + angle;
                        const x1 = 100 + 100 * Math.cos((Math.PI * (startAngle - 90)) / 180);
                        const y1 = 100 + 100 * Math.sin((Math.PI * (startAngle - 90)) / 180);
                        const x2 = 100 + 100 * Math.cos((Math.PI * (endAngle - 90)) / 180);
                        const y2 = 100 + 100 * Math.sin((Math.PI * (endAngle - 90)) / 180);

                        const d = `M 100 100 L ${x1} ${y1} A 100 100 0 0 1 ${x2} ${y2} Z`;
                        const midAngle = startAngle + (angle / 2);
                        const textX = 100 + 65 * Math.cos((Math.PI * (midAngle - 90)) / 180);
                        const textY = 100 + 65 * Math.sin((Math.PI * (midAngle - 90)) / 180);

                        return (
                          <g key={sector.index}>
                            <path d={d} fill={sector.color} stroke="#0f172a" strokeWidth="1.5" />
                            <text
                              x={textX}
                              y={textY}
                              fill={sector.textColor}
                              fontSize="7"
                              fontWeight="bold"
                              textAnchor="middle"
                              dominantBaseline="central"
                              transform={`rotate(${midAngle}, ${textX}, ${textY})`}
                            >
                              {sector.shortName}
                            </text>
                          </g>
                        );
                      })}
                      <circle cx="100" cy="100" r="18" fill="#1e293b" stroke="#f59e0b" strokeWidth="3" />
                      <circle cx="100" cy="100" r="8" fill="#f59e0b" />
                    </svg>
                  </div>

                  {/* Botón de Giro */}
                  <div className="mt-5 w-full">
                    {!hasSpun ? (
                      <button
                        onClick={handleSpinWheel}
                        disabled={isSpinning}
                        className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-2xl text-base shadow-lg shadow-purple-600/25 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RotateCw className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
                        <span>{isSpinning ? 'Girando Ruleta...' : `Girar la Ruleta (Giro ${spinIndex + 1})`}</span>
                      </button>
                    ) : selectedSector ? (
                      <div 
                        className="p-3 rounded-2xl border text-center shadow-lg"
                        style={{ backgroundColor: `${selectedSector.color}20`, borderColor: selectedSector.color }}
                      >
                        <span className="text-[10px] uppercase font-bold text-slate-400">Sector Otorgado • Tiempo Automático</span>
                        <h4 className="text-base font-bold text-white flex items-center justify-center gap-1.5 mt-0.5">
                          <span>{selectedSector.icon}</span>
                          <span>{selectedSector.name}</span>
                        </h4>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Sectores Bíblicos */}
                <div className="w-full grid grid-cols-2 gap-1 text-left pt-2 border-t border-slate-800">
                  {RULETA_SECTORS.map(sec => (
                    <div 
                      key={sec.index}
                      className={`p-1 rounded-lg border text-[10px] flex items-center gap-1 truncate ${
                        selectedSector?.index === sec.index
                          ? 'bg-purple-600 text-white font-bold border-white'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sec.color }}></span>
                      <span className="truncate">{sec.shortName}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Columna Derecha: Pregunta y Reloj de 30s con INICIO AUTOMÁTICO (7 columnas) */}
              <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-5">
                {!hasSpun ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-3">
                    <Disc className="w-16 h-16 opacity-30 stroke-1 text-purple-400" />
                    <p className="text-base font-medium text-slate-300">
                      Gira la ruleta bíblica para el participante <strong className="text-purple-400">{activePlayer.username || activePlayer.name}</strong>.
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      ⚡ Al detenerse la ruleta, el reloj de 30 segundos correrá automáticamente con el mismo dinamismo que Dados.
                    </p>
                  </div>
                ) : loadingQuestion ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-slate-400">Cargando pregunta de {selectedSector?.name}...</p>
                  </div>
                ) : currentQuestion ? (
                  <>
                    {/* Barra de Estado con Reloj Automático de 30s */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{selectedSector?.icon || '📜'}</span>
                        <div>
                          <span className="text-xs uppercase font-bold text-purple-400">
                            {selectedSector?.name}
                          </span>
                          <p className="text-[11px] text-slate-400">Pregunta de 10 Puntos • Tiempo Automático</p>
                        </div>
                      </div>

                      {/* Reloj Automático de 30s */}
                      <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 font-mono text-xl font-black ${
                        timeLeft <= 6 
                          ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse'
                          : timeLeft <= 15
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-700 text-white'
                      }`}>
                        <Clock className="w-5 h-5 text-purple-400" />
                        <span>{timeLeft}s</span>
                      </div>
                    </div>

                    {/* Enunciado de la Pregunta */}
                    <div className="p-4 sm:p-5 bg-slate-950/70 border border-slate-800 rounded-2xl">
                      <h3 className="text-base sm:text-xl font-medium text-white leading-relaxed">
                        {currentQuestion.question_text}
                      </h3>
                    </div>

                    {/* Banner de Resultado */}
                    {answeredState && (
                      <div className={`p-4 rounded-2xl border text-center animate-fadeIn ${
                        answeredState === 'correct'
                          ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                          : answeredState === 'incorrect'
                          ? 'bg-red-950/40 border-red-500 text-red-300'
                          : 'bg-amber-950/40 border-amber-500 text-amber-300'
                      }`}>
                        {answeredState === 'correct' && (
                          <div className="flex items-center justify-center gap-2 font-bold text-base">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <span>¡Respuesta Correcta! (+10 puntos)</span>
                          </div>
                        )}
                        {answeredState === 'incorrect' && (
                          <div className="flex items-center justify-center gap-2 font-bold text-base">
                            <XCircle className="w-5 h-5 text-red-400" />
                            <span>Respuesta Incorrecta (0 puntos)</span>
                          </div>
                        )}
                        {answeredState === 'timeout' && (
                          <div className="flex items-center justify-center gap-2 font-bold text-base">
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                            <span>¡Tiempo de 30s agotado! Pregunta anulada por reglamento (0 puntos)</span>
                          </div>
                        )}
                        {currentQuestion.explanation && (
                          <p className="text-xs text-slate-300 mt-1 italic">
                            💡 {currentQuestion.explanation} ({currentQuestion.verse_reference})
                          </p>
                        )}
                      </div>
                    )}

                    {/* Opciones */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {['a', 'b', 'c', 'd'].map(opt => {
                        const optText = currentQuestion[`option_${opt}`];
                        if (!optText) return null;
                        const isCorrectOpt = (currentQuestion.correct_answer || 'a').toLowerCase() === opt;
                        const isSelectedOpt = selectedOptKey === opt;
                        
                        let btnStyle = 'bg-slate-950/80 border-slate-700/80 text-slate-200 hover:border-purple-400 cursor-pointer';
                        if (answeredState) {
                          if (isCorrectOpt) {
                            btnStyle = 'bg-emerald-600/30 border-emerald-500 text-white font-bold ring-1 ring-emerald-500';
                          } else if (isSelectedOpt && !isCorrectOpt) {
                            btnStyle = 'bg-red-950/90 border-red-500 text-red-200 line-through';
                          } else {
                            btnStyle = 'bg-slate-950/40 border-slate-800 text-slate-500 opacity-60';
                          }
                        }

                        return (
                          <button
                            key={opt}
                            onClick={() => handleAnswer(opt)}
                            disabled={!timerActive || Boolean(answeredState)}
                            className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition ${btnStyle}`}
                          >
                            <span className="w-6 h-6 rounded-md bg-slate-800 text-purple-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                              {opt.toUpperCase()}
                            </span>
                            <span className="text-xs sm:text-sm font-medium leading-snug">{optText}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Botón Siguiente Giro */}
                    {answeredState && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={handleNextSpin}
                          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm shadow-lg active:scale-95 transition flex items-center gap-2 cursor-pointer"
                        >
                          <span>
                            {spinIndex >= TOTAL_SPINS - 1 ? 'Ver Resultado Final' : 'Siguiente Giro'}
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                ) : null}
              </div>

            </div>
          ) : (
            /* TANDA DE 8 GIROS COMPLETADA */
            <div className="bg-slate-900/90 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-amber-500 text-white flex items-center justify-center mx-auto text-3xl shadow-xl shadow-purple-500/30">
                <Trophy className="w-8 h-8 text-white animate-bounce" />
              </div>

              <div className="space-y-1">
                <span className="text-xs uppercase font-extrabold text-amber-400 tracking-widest font-mono">
                  ¡8 Giros de Ruleta Completados!
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-serif text-white">
                  {activePlayer.username || activePlayer.name} obtuvo <span className="text-purple-400 font-mono">{score} / 80 puntos</span>
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto pt-1">
                  Tu puntuación se suma a los <strong>{activePlayerDado} pts</strong> de El Dado Dado para un <strong className="text-amber-400">Total Combinado de {activePlayerCombined} pts</strong>.
                </p>
              </div>

              {/* Banner de Puntos de Sabiduría Acreditados */}
              {wisdomAwarded && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/20 via-amber-500/25 to-purple-500/20 border-2 border-amber-400/80 shadow-xl max-w-md mx-auto space-y-1">
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

              {/* Historial de Giros */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-xl mx-auto">
                {spinHistory.map((item, i) => (
                  <div key={i} className={`p-2.5 rounded-xl border text-xs text-left ${
                    item.result === 'correct' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-red-950/40 border-red-500/30 text-red-300'
                  }`}>
                    <div className="flex justify-between font-mono font-bold">
                      <span>Giro {item.spin}</span>
                      <span>+{item.points} pts</span>
                    </div>
                    <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                      {item.sectorIcon} {item.sectorName}
                    </span>
                  </div>
                ))}
              </div>

              {/* Botones de Acción */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setRoundFinished(false);
                    setSpinIndex(0);
                    setScore(0);
                    setCorrectCount(0);
                    setSpinHistory([]);
                    setHasSpun(false);
                    setCurrentQuestion(null);
                    setWisdomAwarded(null);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs sm:text-sm rounded-xl shadow-xl cursor-pointer flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Jugar Otra Tanda de 8</span>
                </button>

                <button
                  onClick={() => setActiveView('leaderboard')}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer flex items-center gap-2"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
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
