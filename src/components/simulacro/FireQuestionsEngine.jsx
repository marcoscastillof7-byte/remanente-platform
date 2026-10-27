import { useState, useEffect, useRef } from 'react';
import { 
  Flame, Clock, Play, RotateCcw, ArrowRight, Award, Shield, 
  AlertCircle, CheckCircle2, XCircle, Users, Upload, Sparkles, 
  UserCheck, Trophy, ChevronRight, Check, Zap, Star
} from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { playNotificationSound } from '../../utils/notificationSound';

// Helper de audio sintetizado para feedback instantáneo
const playTone = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'paso') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.setValueAtTime(450, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'tick') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    }
  } catch (e) {}
};

const CATEGORIES = [
  { id: 'personajes', name: 'Personajes', icon: '👤', color: 'from-blue-600 to-indigo-600', desc: 'Reyes, profetas, valientes y personajes de Samuel y Reyes' },
  { id: 'lugares', name: 'Lugares', icon: '📍', color: 'from-emerald-600 to-teal-600', desc: 'Ciudades, montes, valles, ríos y territorios bíblicos' },
  { id: 'cantidades', name: 'Cantidades', icon: '🔢', color: 'from-amber-600 to-yellow-600', desc: 'Números, años, medidas en codos, soldados y días' },
  { id: 'eventos', name: 'Eventos', icon: '⚡', color: 'from-purple-600 to-pink-600', desc: 'Batallas, milagros, pactos, coronaciones y juicios' }
];

export default function FireQuestionsEngine({ 
  players = [], 
  teams = [], 
  onCompletePhase, 
  onOpenDisciplinary, 
  onOpenImporter 
}) {
  const { user: currentUser } = useAuth();

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

  // Lista de participantes de la plataforma para el ranking comparativo
  const effectivePlayers = (Array.isArray(players) && players.length > 0)
    ? players
    : ((Array.isArray(teams) && teams.length > 0) ? teams : [
        { id: activePlayer.id, username: activePlayer.username, points: activePlayer.points, badge: '👑' }
      ]);

  // Vista activa: 'player' (Ronda individual del usuario conectado) | 'leaderboard' (Tabla General de Clasificación)
  const [activeView, setActiveView] = useState('player');

  // Registro persistente de rendimiento por jugador: playerId -> { bestScore, runs: [...] }
  const [playerRecords, setPlayerRecords] = useState(() => {
    try {
      const saved = localStorage.getItem('simulacro_fire_player_records');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Guardar récords en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('simulacro_fire_player_records', JSON.stringify(playerRecords));
    } catch (e) {}
  }, [playerRecords]);

  // Estado del apartado de juego individual del jugador
  const [selectedCategory, setSelectedCategory] = useState('personajes');
  const [isPlaying, setIsPlaying] = useState(false);
  const [roundFinished, setRoundFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(90);
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Estadísticas de la ronda en curso
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [pasoCount, setPasoCount] = useState(0);
  const [selectedOptKey, setSelectedOptKey] = useState(null);
  const [isNewRecord, setIsNewRecord] = useState(false);

  const timerRef = useRef(null);

  // Cargar preguntas de la categoría elegida
  const loadCategoryQuestions = async (catId) => {
    setSelectedCategory(catId);
    setLoadingQuestions(true);
    try {
      const res = await api.get(`/simulacro/questions/fire-questions?category=${catId}&count=60`);
      if (res && res.questions && res.questions.length > 0) {
        setQuestions(res.questions);
      }
    } catch (e) {
      console.error('Error cargando preguntas:', e);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Cargar preguntas iniciales al montar o al cambiar de categoría
  useEffect(() => {
    loadCategoryQuestions(selectedCategory);
  }, [selectedCategory]);

  // Iniciar la ronda individual de 90 segundos del jugador
  const handleStartRound = () => {
    setIsPlaying(true);
    setRoundFinished(false);
    setTimeLeft(90);
    setScore(0);
    setCorrectCount(0);
    setIncorrectCount(0);
    setPasoCount(0);
    setQIndex(0);
    setSelectedOptKey(null);
    setIsNewRecord(false);
    playNotificationSound();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleFinishRound();
          return 0;
        }
        if (prev <= 5) {
          playTone('tick');
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Finalizar la ronda de 90 segundos
  const handleFinishRound = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPlaying(false);
    setRoundFinished(true);
    playNotificationSound();

    // Actualizar registro del jugador
    setScore(currentScore => {
      setPlayerRecords(prev => {
        const pId = String(activePlayer.id);
        const existing = prev[pId] || { bestScore: 0, runs: [] };
        const newBest = Math.max(existing.bestScore || 0, currentScore);
        const isBetter = currentScore > (existing.bestScore || 0);
        setIsNewRecord(isBetter);

        const newRun = {
          score: currentScore,
          correct: correctCount,
          incorrect: incorrectCount,
          pasos: pasoCount,
          category: selectedCategory,
          date: new Date().toISOString()
        };

        return {
          ...prev,
          [pId]: {
            player: activePlayer,
            bestScore: newBest,
            lastScore: currentScore,
            totalRuns: (existing.runs?.length || 0) + 1,
            runs: [newRun, ...(existing.runs || [])].slice(0, 10)
          }
        };
      });
      return currentScore;
    });
  };

  // Limpieza de temporizador al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Respuesta del jugador: selección entre A, B, C, D
  const handleAnswerOption = (optKey) => {
    if (!isPlaying || roundFinished || timeLeft <= 0 || !questions[qIndex]) return;

    setSelectedOptKey(optKey);
    const curQ = questions[qIndex];
    const isCorrect = (curQ.correct_answer || 'a').toLowerCase() === optKey.toLowerCase();

    if (isCorrect) {
      setScore(prev => prev + 10);
      setCorrectCount(prev => prev + 1);
      playTone('correct');
    } else {
      setIncorrectCount(prev => prev + 1);
      playTone('wrong');
    }

    // Avanzar de inmediato a la siguiente pregunta
    setTimeout(() => {
      setSelectedOptKey(null);
      setQIndex(prev => prev + 1);
    }, 150);
  };

  // Botón "PASO" (0 puntos, sin penalización)
  const handlePaso = () => {
    if (!isPlaying || roundFinished || timeLeft <= 0) return;
    setPasoCount(prev => prev + 1);
    playTone('paso');
    setSelectedOptKey(null);
    setQIndex(prev => prev + 1);
  };

  // Controles por teclado: Teclas 1, 2, 3, 4 o A, B, C, D y Espacio/P para Paso
  useEffect(() => {
    if (!isPlaying || roundFinished) return;

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'a' || key === '1') handleAnswerOption('a');
      else if (key === 'b' || key === '2') handleAnswerOption('b');
      else if (key === 'c' || key === '3') handleAnswerOption('c');
      else if (key === 'd' || key === '4') handleAnswerOption('d');
      else if (key === ' ' || key === 'p') {
        e.preventDefault();
        handlePaso();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, roundFinished, qIndex, questions]);

  // Tabla general de clasificación ordenada por mejor puntaje
  const sortedLeaderboard = effectivePlayers.map(p => {
    const rec = playerRecords[String(p.id)];
    return {
      player: p,
      bestScore: rec ? rec.bestScore : 0,
      totalRuns: rec ? rec.totalRuns : 0,
      lastCategory: rec?.runs?.[0]?.category || 'personajes',
      hasPlayed: Boolean(rec && rec.runs?.length > 0)
    };
  }).sort((a, b) => b.bestScore - a.bestScore);

  const top4Qualified = sortedLeaderboard.slice(0, 4);

  // Finalizar fase y enviar los 4 clasificados a David contra Goliat
  const handleAdvanceToPhase2 = () => {
    if (onCompletePhase) {
      onCompletePhase({
        phase: 'fire_questions',
        qualifiedPlayers: top4Qualified.map((entry, idx) => ({
          ...entry.player,
          seed: idx + 1,
          fireScore: entry.bestScore
        })),
        qualifiedTeams: top4Qualified.map((entry, idx) => ({
          ...entry.player,
          seed: idx + 1,
          fireScore: entry.bestScore
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
      <div className="bg-gradient-to-r from-red-950/80 via-slate-900 to-amber-950/80 border-2 border-red-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 via-amber-600 to-yellow-500 flex items-center justify-center text-3xl shadow-lg shadow-red-500/30 text-white font-black">
            🔥
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-500/15 px-2.5 py-0.5 rounded-full border border-red-500/30">
                Fase 1 • Eliminatoria Individual
              </span>
              <span className="text-xs text-slate-400 font-mono">90s por Jugador • Apartado Dedicado</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-serif text-white tracking-wide mt-0.5">
              Fire Questions: Rondas Individuales
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
            <span>{activeView === 'leaderboard' ? 'Volver a Mi Ronda' : '🏆 Tabla de Clasificación'}</span>
          </button>

          {onOpenImporter && (
            <button
              type="button"
              onClick={onOpenImporter}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600/30 to-amber-500/20 hover:from-amber-600/40 hover:to-amber-500/30 border border-amber-500/50 text-amber-300 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition shadow cursor-pointer"
              title="Importar preguntas bíblicas clasificadas"
            >
              <Upload className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Importador</span>
            </button>
          )}

          <button
            onClick={() => onOpenDisciplinary && onOpenDisciplinary(activePlayer)}
            className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Shield className="w-4 h-4 text-red-400" />
            <span>Arbitraje</span>
          </button>
        </div>
      </div>

      {/* VISTA 1: TABLA GENERAL DE CLASIFICACIÓN (SI EL USUARIO ELIGIÓ VER LA TABLA) */}
      {activeView === 'leaderboard' ? (
        <div className="bg-slate-900/90 border border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-gold" />
                <span>Clasificación General Oficial</span>
              </span>
              <h2 className="text-2xl font-black font-serif text-white mt-1">
                Tabla de Posiciones - Fire Questions
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Rendimiento de los participantes registrados. Cada quien compite exclusivamente para su cuenta personal.
              </p>
            </div>

            <button
              onClick={() => setActiveView('player')}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-xl flex items-center gap-2 cursor-pointer uppercase tracking-wider shrink-0"
            >
              <span>Volver a Mi Ronda</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {sortedLeaderboard.map((item, idx) => {
              const isQualified = idx < 4 && item.bestScore > 0;
              const isMe = String(item.player.id) === String(activePlayer.id);

              return (
                <div
                  key={item.player.id}
                  className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                    isMe
                      ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-500 shadow-xl'
                      : isQualified
                      ? 'bg-gradient-to-r from-amber-950/20 via-slate-950/80 to-slate-950 border-amber-500/30'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-black text-xs ${
                      idx === 0 
                        ? 'bg-gradient-to-tr from-yellow-400 to-amber-500 text-slate-950 shadow-md' 
                        : idx === 1 
                        ? 'bg-slate-300 text-slate-950' 
                        : idx === 2 
                        ? 'bg-amber-700 text-white' 
                        : idx === 3 
                        ? 'bg-blue-600 text-white' 
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
                            <span className="text-[10px] font-black uppercase bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full shadow">
                              ⭐ Tu Cuenta
                            </span>
                          )}
                          {isQualified && !isMe && (
                            <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                              Top 4
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {item.totalRuns} {item.totalRuns === 1 ? 'ronda jugada' : 'rondas jugadas'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <span className="text-xl sm:text-2xl font-black font-mono text-amber-400 block">
                        {item.bestScore} <span className="text-xs text-slate-400 font-normal">pts</span>
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
        /* VISTA 2: APARTADO INDIVIDUAL DEL JUGADOR SELECCIONADO */
        <div className="space-y-6">

          {/* PERFIL Y ESTADÍSTICAS DEL JUGADOR SELECCIONADO */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 via-amber-600 to-amber-500 flex items-center justify-center text-white text-xl font-black shadow-lg border border-amber-400/30">
                {(activePlayer.username || activePlayer.name || 'J').substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    Tu Cuenta Personal
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Saldo: {activePlayer.points || 0} pts
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white font-serif mt-0.5">
                  {activePlayer.username || activePlayer.name}
                </h2>
              </div>
            </div>

            {/* Tarjeta de Récord Personal en Fire Questions */}
            <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl w-full sm:w-auto justify-between sm:justify-start">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Récord Personal</span>
                <span className="text-2xl font-black font-mono text-amber-400">
                  {activeRecord?.bestScore || 0} <span className="text-xs text-slate-400 font-normal">pts</span>
                </span>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Rondas Jugadas</span>
                <span className="text-base font-bold font-mono text-slate-200">
                  {activeRecord?.runs?.length || 0}
                </span>
              </div>
            </div>
          </div>

          {/* ESTADO 1: ANTES DE INICIAR LA RONDA (ELECCIÓN DE CATEGORÍA Y BOTÓN INICIAR) */}
          {!isPlaying && !roundFinished && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
              
              <div className="text-center space-y-1.5 max-w-xl mx-auto">
                <span className="text-xs font-black uppercase tracking-widest text-red-400">
                  Sprint Bíblico de 90 Segundos
                </span>
                <h3 className="text-xl sm:text-2xl font-bold font-serif text-white">
                  Elige tu Categoría Bíblica
                </h3>
                <p className="text-xs text-slate-400">
                  Cada acierto suma <strong>+10 puntos</strong>. Si dudas en alguna pregunta, presiona <strong>«PASO»</strong> para no perder tiempo.
                </p>
              </div>

              {/* Grid de las 4 Categorías Bíblicas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {CATEGORIES.map(cat => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => loadCategoryQuestions(cat.id)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'bg-slate-950 border-amber-400 shadow-xl shadow-amber-500/10 ring-2 ring-amber-400/50 scale-[1.02]'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950/90'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-3xl p-2 rounded-xl bg-slate-900 border border-slate-800">{cat.icon}</span>
                        {isSelected && (
                          <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs">
                            ✓
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="font-bold text-white text-base">{cat.name}</h4>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{cat.desc}</p>
                      </div>

                      <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-500">Oficial NTV</span>
                        <span className={isSelected ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                          {isSelected ? 'Seleccionada' : 'Elegir'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Botón de Inicio de la Ronda */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-red-950/40 via-slate-950 to-amber-950/40 border border-red-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30">
                    <Flame className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">¿Listo para iniciar tu turno?</h4>
                    <p className="text-xs text-slate-400">
                      Categoría activa: <strong className="text-amber-300 uppercase">{selectedCategory}</strong> • El reloj de 90 segundos iniciará de inmediato.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleStartRound}
                  disabled={loadingQuestions || questions.length === 0}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black text-sm rounded-xl shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider transition transform hover:scale-105 active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>{loadingQuestions ? 'Cargando preguntas...' : 'Iniciar Mi Ronda (90s)'}</span>
                </button>
              </div>

            </div>
          )}

          {/* ESTADO 2: RONDA EN JUEGO (90 SEGUNDOS ACTIVOS) */}
          {isPlaying && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 animate-fadeIn">
              
              {/* Barra de Tiempo y Marcador en Vivo */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                    timeLeft <= 10 
                      ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' 
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  }`}>
                    <Clock className="w-5 h-5 animate-spin" />
                    <span className="text-2xl sm:text-3xl font-black font-mono">{timeLeft}s</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-mono block">Categoría</span>
                    <span className="text-xs font-bold text-amber-300 uppercase">{selectedCategory}</span>
                  </div>
                </div>

                {/* Marcador de Aciertos en Vivo */}
                <div className="flex items-center gap-3 justify-end">
                  <div className="text-right">
                    <span className="text-3xl sm:text-4xl font-black font-mono text-amber-400 block leading-none">
                      {score}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">PUNTOS</span>
                  </div>

                  <div className="h-8 w-px bg-slate-800 hidden sm:block" />

                  <div className="flex gap-2 text-xs font-mono">
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg font-bold">
                      ✓ {correctCount}
                    </span>
                    <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg font-bold">
                      ✗ {incorrectCount}
                    </span>
                    <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded-lg font-bold">
                      ↷ {pasoCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Barra de Progreso del Tiempo (90s) */}
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className={`h-full transition-all duration-1000 ${
                    timeLeft <= 15 ? 'bg-red-500' : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                  }`}
                  style={{ width: `${(timeLeft / 90) * 100}%` }}
                />
              </div>

              {/* Pregunta Activa */}
              {currentQ ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                    <span className="font-mono font-bold text-amber-400">Pregunta #{qIndex + 1}</span>
                    {currentQ.verse_reference && (
                      <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-slate-300">
                        📖 {currentQ.verse_reference}
                      </span>
                    )}
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800">
                    <h3 className="text-lg sm:text-2xl font-bold text-white leading-relaxed">
                      {currentQ.question_text}
                    </h3>
                  </div>

                  {/* 4 Opciones de Respuesta */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {['a', 'b', 'c', 'd'].map(optKey => {
                      const optText = currentQ[`option_${optKey}`];
                      if (!optText) return null;

                      const isSelected = selectedOptKey === optKey;

                      return (
                        <button
                          key={optKey}
                          onClick={() => handleAnswerOption(optKey)}
                          className={`p-4 rounded-2xl border-2 text-left transition-all duration-150 flex items-start gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-400 text-white scale-[1.01]'
                              : 'bg-slate-950/80 border-slate-800 hover:border-amber-500/60 hover:bg-slate-800/60 text-slate-200'
                          }`}
                        >
                          <span className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center font-mono font-bold text-xs uppercase shrink-0">
                            {optKey}
                          </span>
                          <span className="text-sm sm:text-base font-medium leading-snug pt-0.5">
                            {optText}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Botón PASO */}
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handlePaso}
                      className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer flex items-center gap-2"
                      title="Pasar a la siguiente pregunta sin penalización"
                    >
                      <span>↷ PASO (Presiona Espacio o P)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  Cargando más preguntas bíblicas...
                </div>
              )}

            </div>
          )}

          {/* ESTADO 3: RONDA FINALIZADA (RESUMEN DEL JUGADOR) */}
          {roundFinished && (
            <div className="bg-slate-900/90 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-fadeIn">
              
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center mx-auto text-3xl shadow-xl shadow-amber-500/30">
                <Trophy className="w-8 h-8 animate-bounce text-slate-950" />
              </div>

              <div className="space-y-1">
                <span className="text-xs uppercase font-extrabold text-amber-400 tracking-widest font-mono">
                  ¡Ronda de 90 Segundos Completada!
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-serif text-white">
                  {activePlayer.username || activePlayer.name} obtuvo <span className="text-amber-400 font-mono">{score} puntos</span>
                </h3>
                {isNewRecord && (
                  <p className="text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full inline-block mt-1">
                    🎉 ¡Nuevo Récord Personal Superado!
                  </p>
                )}
              </div>

              {/* Desglose de Estadísticas de la Ronda */}
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/30">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block">Aciertos (+10)</span>
                  <span className="text-2xl font-black font-mono text-emerald-300 mt-0.5 block">{correctCount}</span>
                </div>

                <div className="p-3 bg-red-950/40 rounded-xl border border-red-500/30">
                  <span className="text-[10px] uppercase font-bold text-red-400 block">Fallos (0 pts)</span>
                  <span className="text-2xl font-black font-mono text-red-300 mt-0.5 block">{incorrectCount}</span>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Pasos</span>
                  <span className="text-2xl font-black font-mono text-slate-300 mt-0.5 block">{pasoCount}</span>
                </div>
              </div>

              {/* Botones de Acción Posterior a la Ronda */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setRoundFinished(false);
                    setIsPlaying(false);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black text-xs sm:text-sm rounded-xl shadow-xl cursor-pointer flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Jugar Otra Ronda / Mejorar Récord</span>
                </button>

                <button
                  onClick={() => setActiveView('leaderboard')}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer flex items-center gap-2"
                >
                  <Trophy className="w-4 h-4 text-gold" />
                  <span>Ver Tabla de Clasificación General</span>
                </button>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
