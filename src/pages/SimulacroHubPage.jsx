import { useState, useEffect } from 'react';
import { 
  Trophy, Flame, Swords, Dices, Disc, Users, BookOpen, Shield, 
  RotateCcw, Sparkles, CheckCircle2, ChevronRight, Play, Award,
  AlertTriangle, RefreshCw, Star, Info, Upload, UserCheck, Plus, Check,
  Lock, ArrowLeft
} from 'lucide-react';
import FireQuestionsEngine from '../components/simulacro/FireQuestionsEngine';
import DavidGoliatEngine from '../components/simulacro/DavidGoliatEngine';
import DadoDadoEngine from '../components/simulacro/DadoDadoEngine';
import RuletaEngine from '../components/simulacro/RuletaEngine';
import DisciplinaryCardModal from '../components/simulacro/DisciplinaryCardModal';
import FireQuestionsImporterModal from '../components/simulacro/FireQuestionsImporterModal';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';

const PALETTE = [
  { color: '#3b82f6', badge: '👑' },
  { color: '#10b981', badge: '⚔️' },
  { color: '#f59e0b', badge: '🛡️' },
  { color: '#8b5cf6', badge: '⚡' },
  { color: '#ec4899', badge: '🌟' },
  { color: '#06b6d4', badge: '💎' },
  { color: '#f97316', badge: '🔥' },
  { color: '#14b8a6', badge: '🎯' },
  { color: '#6366f1', badge: '🏹' },
  { color: '#eab308', badge: '🏆' }
];

export default function SimulacroHubPage() {
  const { user: currentUser } = useAuth();

  // Pestaña principal: 'competiciones' | 'tabla' | 'reglamento'
  const [activeTab, setActiveTab] = useState('competiciones');

  // Categoría activa de juego individual: 'fire' | 'david' | 'dado' | 'ruleta' | null
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Jugadores registrados en la plataforma
  const [platformPlayers, setPlatformPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // Modales
  const [disciplinaryOpen, setDisciplinaryOpen] = useState(false);
  const [disciplinaryTargetPlayer, setDisciplinaryTargetPlayer] = useState(null);
  const [fireImporterOpen, setFireImporterOpen] = useState(false);

  // Récords guardados en localStorage
  const [allRecords, setAllRecords] = useState({
    fire: {},
    david: {},
    dado: {},
    ruleta: {}
  });

  const reloadRecords = () => {
    try {
      const fire = JSON.parse(localStorage.getItem('simulacro_fire_player_records') || '{}');
      const david = JSON.parse(localStorage.getItem('simulacro_david_player_records') || '{}');
      const dado = JSON.parse(localStorage.getItem('simulacro_dado_player_records') || '{}');
      const ruleta = JSON.parse(localStorage.getItem('simulacro_ruleta_player_records') || '{}');
      setAllRecords({ fire, david, dado, ruleta });
    } catch (e) {}
  };

  useEffect(() => {
    reloadRecords();
  }, [selectedCategory, activeTab]);

  // Cargar usuarios de la plataforma
  useEffect(() => {
    setLoadingPlayers(true);
    api.get('/simulacro/users')
      .then(res => {
        if (res && res.users && res.users.length > 0) {
          const formatted = res.users.map((u, idx) => ({
            id: u.id,
            username: u.username || `Usuario ${u.id}`,
            points: typeof u.points === 'number' ? u.points : 0,
            role: u.role || 'user',
            color: PALETTE[idx % PALETTE.length].color,
            badge: PALETTE[idx % PALETTE.length].badge
          }));
          setPlatformPlayers(formatted);
        }
      })
      .catch(err => console.warn('Error cargando usuarios para Simulacro:', err))
      .finally(() => setLoadingPlayers(false));
  }, []);

  // Abrir modal de arbitraje
  const openDisciplinary = (player) => {
    setDisciplinaryTargetPlayer(player || currentUser || platformPlayers[0]);
    setDisciplinaryOpen(true);
  };

  const handleApplyDisciplinaryCard = (cardData) => {
    console.log('[Arbitraje] Tarjeta aplicada a jugador:', cardData);
  };

  const handleAnnulQuestion = (reason) => {
    console.log('[Arbitraje] Pregunta anulada:', reason);
  };

  // Récords personales del usuario conectado
  const myUserId = currentUser?.id ? String(currentUser.id) : null;
  const myFireBest = myUserId ? (allRecords.fire[myUserId]?.bestScore || 0) : 0;
  const myDavidBest = myUserId ? (allRecords.david[myUserId]?.bestScore || 0) : 0;
  const myDadoBest = myUserId ? (allRecords.dado[myUserId]?.bestScore || 0) : 0;
  const myRuletaBest = myUserId ? (allRecords.ruleta[myUserId]?.bestScore || 0) : 0;
  const myTotalScore = myFireBest + myDavidBest + myDadoBest + myRuletaBest;

  // Tabla de honor general combinando todas las categorías
  const overallLeaderboard = platformPlayers.map(p => {
    const pId = String(p.id);
    const fire = allRecords.fire[pId]?.bestScore || 0;
    const david = allRecords.david[pId]?.bestScore || 0;
    const dado = allRecords.dado[pId]?.bestScore || 0;
    const ruleta = allRecords.ruleta[pId]?.bestScore || 0;
    const total = fire + david + dado + ruleta;

    return {
      player: p,
      fire,
      david,
      dado,
      ruleta,
      total
    };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      
      {/* Banner Principal de la Sección Simulacro */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 blur-3xl rounded-full pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-widest flex items-center gap-1.5 shadow">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Olimpiadas Bíblicas Oficiales
              </span>
              <span className="text-xs text-emerald-400 font-mono font-semibold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <Lock className="w-3 h-3" />
                Competición Individual e Intransferible
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-serif text-white tracking-tight">
              Simulacro de Competencia
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Cada participante compite exclusivamente para su propia cuenta en las 4 disciplinas oficiales:
              <strong className="text-amber-300"> Fire Questions</strong> (90s continuos),
              <strong className="text-blue-300"> David contra Goliat</strong> (20 preguntas con pulsador),
              <strong className="text-emerald-300"> El Dado Dado</strong> (8 tiradas de dado 3D) y
              <strong className="text-purple-300"> La Ruleta</strong> (8 giros bíblicos con reloj automático de 30s).
              <span className="block mt-1.5 text-amber-300/90 font-medium">
                🌟 ¡Todos los puntos ganados se transfieren automáticamente como <strong>Puntos de Sabiduría</strong> a tu cuenta en Supabase!
              </span>
            </p>
          </div>

          {/* Tarjeta de Cuenta Conectada + Acciones Rápidas */}
          <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-3 w-full md:w-auto">
            {currentUser && (
              <div className="p-3 bg-slate-900/90 border border-amber-500/40 rounded-2xl flex items-center gap-3 w-full sm:w-auto">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 font-black flex items-center justify-center text-sm shadow">
                  {(currentUser.username || 'U').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                    Tu Cuenta Conectada:
                  </span>
                  <div className="text-sm font-black text-white flex items-center gap-1.5">
                    <span>{currentUser.username}</span>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.2 rounded border border-emerald-500/30" title="Récord Simulacro">
                      {myTotalScore} pts
                    </span>
                    <span className="text-[10px] font-mono text-amber-300 font-bold bg-amber-500/15 px-1.5 py-0.2 rounded border border-amber-500/30" title="Puntos de Sabiduría">
                      ✨ {typeof currentUser.points === 'number' ? currentUser.points : 0} sab.
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFireImporterOpen(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-600/30 to-amber-500/20 hover:from-amber-600/40 hover:to-amber-500/30 border border-amber-500/50 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow cursor-pointer"
                title="Importar preguntas para cada sección de Fire Questions"
              >
                <Upload className="w-4 h-4 text-amber-400" />
                <span>Importador</span>
              </button>

              <button
                onClick={() => openDisciplinary(currentUser)}
                className="px-3.5 py-2 bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow cursor-pointer"
                title="Panel de Arbitraje"
              >
                <Shield className="w-4 h-4 text-red-400" />
                <span>Arbitraje</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación del Simulacro (Sin Torneo Oficial) */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-slate-800 text-xs sm:text-sm font-bold">
          <button
            onClick={() => {
              setActiveTab('competiciones');
              setSelectedCategory(null);
            }}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'competiciones'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Competiciones Individuales</span>
          </button>

          <button
            onClick={() => setActiveTab('tabla')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'tabla'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Tabla de Honor General</span>
          </button>

          <button
            onClick={() => setActiveTab('reglamento')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'reglamento'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Reglamento NTV</span>
          </button>
        </div>
      </div>

      {/* 1. PESTAÑA: COMPETICIONES INDIVIDUALES */}
      {activeTab === 'competiciones' && (
        <div className="space-y-6">
          {!selectedCategory ? (
            /* Cuadrícula de Selección de las 4 Categorías */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Categoría 1: Fire Questions */}
              <div 
                onClick={() => setSelectedCategory('fire')}
                className="bg-slate-900/90 border-2 border-orange-500/30 hover:border-orange-500 rounded-3xl p-6 sm:p-7 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-orange-500/10 space-y-5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-3.5 bg-orange-500/20 text-orange-400 rounded-2xl group-hover:bg-orange-500 group-hover:text-slate-950 transition-all shadow-md">
                    <Flame className="w-8 h-8" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20 block">
                      Categoría 1
                    </span>
                    <span className="text-xs font-mono text-slate-400 mt-1 block">
                      Tu Récord: <strong className="text-amber-400">{myFireBest} pts</strong>
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold font-serif text-white group-hover:text-amber-300 transition">
                    Fire Questions
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                    Ronda de <strong>90 segundos ininterrumpidos</strong> con 4 subcategorías (Personajes, Lugares, Cantidades, Eventos), botón «PASO», opciones múltiples y +10 puntos por acierto.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 text-xs">
                  <span className="text-slate-400 font-mono">Modo: Individual</span>
                  <div className="flex items-center gap-1.5 text-orange-400 font-bold group-hover:translate-x-1 transition-transform">
                    <span>Entrar a Competir</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Categoría 2: David contra Goliat */}
              <div 
                onClick={() => setSelectedCategory('david')}
                className="bg-slate-900/90 border-2 border-blue-500/30 hover:border-blue-500 rounded-3xl p-6 sm:p-7 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-blue-500/10 space-y-5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-3.5 bg-blue-500/20 text-blue-400 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-all shadow-md">
                    <Swords className="w-8 h-8" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 block">
                      Categoría 2
                    </span>
                    <span className="text-xs font-mono text-slate-400 mt-1 block">
                      Tu Récord: <strong className="text-amber-400">{myDavidBest} pts</strong>
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold font-serif text-white group-hover:text-blue-300 transition">
                    David contra Goliat
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                    Desafío de <strong>20 preguntas al Gigante Goliat</strong> con pulsador de honda. Tienes 10 segundos para responder entre 4 opciones tras presionar el pulsador.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 text-xs">
                  <span className="text-slate-400 font-mono">Modo: Individual</span>
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold group-hover:translate-x-1 transition-transform">
                    <span>Entrar a Competir</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Categoría 3: El Dado Dado */}
              <div 
                onClick={() => setSelectedCategory('dado')}
                className="bg-slate-900/90 border-2 border-emerald-500/30 hover:border-emerald-500 rounded-3xl p-6 sm:p-7 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-emerald-500/10 space-y-5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-3.5 bg-emerald-500/20 text-emerald-400 rounded-2xl group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all shadow-md">
                    <Dices className="w-8 h-8" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 block">
                      Categoría 3
                    </span>
                    <span className="text-xs font-mono text-slate-400 mt-1 block">
                      Tu Récord: <strong className="text-amber-400">{myDadoBest} pts</strong>
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold font-serif text-white group-hover:text-emerald-300 transition">
                    El Dado Dado
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                    Tanda de <strong>8 lanzamientos individuales con dado 3D</strong> sobre 6 temáticas bíblicas. El reloj de 30 segundos inicia automáticamente al revelarse la temática.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 text-xs">
                  <span className="text-slate-400 font-mono">Modo: Individual</span>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                    <span>Entrar a Competir</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Categoría 4: La Ruleta */}
              <div 
                onClick={() => setSelectedCategory('ruleta')}
                className="bg-slate-900/90 border-2 border-purple-500/30 hover:border-purple-500 rounded-3xl p-6 sm:p-7 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-2xl hover:shadow-purple-500/10 space-y-5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="p-3.5 bg-purple-500/20 text-purple-400 rounded-2xl group-hover:bg-purple-500 group-hover:text-white transition-all shadow-md">
                    <Disc className="w-8 h-8" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20 block">
                      Categoría 4
                    </span>
                    <span className="text-xs font-mono text-slate-400 mt-1 block">
                      Tu Récord: <strong className="text-amber-400">{myRuletaBest} pts</strong>
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold font-serif text-white group-hover:text-purple-300 transition">
                    La Ruleta Bíblica
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                    Tanda de <strong>8 giros individuales en la ruleta de 8 sectores</strong> de Samuel y Reyes. El reloj de 30 segundos inicia automáticamente con el mismo dinamismo que Dados.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 text-xs">
                  <span className="text-slate-400 font-mono">Modo: Individual</span>
                  <div className="flex items-center gap-1.5 text-purple-400 font-bold group-hover:translate-x-1 transition-transform">
                    <span>Entrar a Competir</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* Barra de Navegación Rápida entre Categorías y Renderizado del Motor */
            <div className="space-y-4 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver a Categorías</span>
                </button>

                {/* Accesos directos a las 4 categorías */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
                  {[
                    { id: 'fire', label: 'Fire Questions', icon: '🔥', color: 'text-orange-400' },
                    { id: 'david', label: 'David vs Goliat', icon: '⚔️', color: 'text-blue-400' },
                    { id: 'dado', label: 'El Dado Dado', icon: '🎲', color: 'text-emerald-400' },
                    { id: 'ruleta', label: 'La Ruleta', icon: '💿', color: 'text-purple-400' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'bg-amber-500 text-slate-950 shadow font-black'
                          : 'bg-slate-950/70 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Motores de Competencia Individual */}
              {selectedCategory === 'fire' && (
                <FireQuestionsEngine
                  players={platformPlayers}
                  onOpenDisciplinary={openDisciplinary}
                  onOpenImporter={() => setFireImporterOpen(true)}
                />
              )}

              {selectedCategory === 'david' && (
                <DavidGoliatEngine
                  availableUsers={platformPlayers}
                  onOpenDisciplinary={openDisciplinary}
                />
              )}

              {selectedCategory === 'dado' && (
                <DadoDadoEngine
                  finalistPlayers={platformPlayers}
                  onOpenDisciplinary={openDisciplinary}
                />
              )}

              {selectedCategory === 'ruleta' && (
                <RuletaEngine
                  finalistPlayers={platformPlayers}
                  onOpenDisciplinary={openDisciplinary}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. PESTAÑA: TABLA DE HONOR GENERAL */}
      {activeTab === 'tabla' && (
        <div className="bg-slate-900/90 border border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-gold" />
                <span>Olimpiadas Bíblicas • Ranking Acumulado</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-black font-serif text-white mt-1">
                Tabla de Honor de la Plataforma
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Puntajes máximos alcanzados por los integrantes registrados en las 4 competencias individuales.
              </p>
            </div>

            <button
              onClick={reloadRecords}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Actualizar Tabla</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase text-slate-400 font-mono">
                  <th className="py-3 px-4">Posición</th>
                  <th className="py-3 px-4">Participante</th>
                  <th className="py-3 px-4 text-center">🔥 Fire Questions</th>
                  <th className="py-3 px-4 text-center">⚔️ David vs Goliat</th>
                  <th className="py-3 px-4 text-center">🎲 El Dado Dado</th>
                  <th className="py-3 px-4 text-center">💿 La Ruleta</th>
                  <th className="py-3 px-4 text-center">TOTAL ACUMULADO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {overallLeaderboard.map((item, idx) => {
                  const isMe = currentUser && String(currentUser.id) === String(item.player.id);

                  return (
                    <tr 
                      key={item.player.id} 
                      className={`hover:bg-slate-800/40 transition ${
                        isMe ? 'bg-amber-950/40 font-bold ring-1 ring-amber-500/50' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono">
                        {idx === 0 ? '🥇 1º Puesto' : idx === 1 ? '🥈 2º Puesto' : idx === 2 ? '🥉 3º Puesto' : `${idx + 1}º`}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-bold text-white border border-slate-700">
                            {(item.player.username || item.player.name || 'J').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-white font-bold block">{item.player.username || item.player.name}</span>
                              {isMe && (
                                <span className="text-[10px] font-black uppercase bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full shadow">
                                  ⭐ Tu Cuenta
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-orange-400 font-bold">
                        {item.fire} pts
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-blue-400 font-bold">
                        {item.david} pts
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-emerald-400 font-bold">
                        {item.dado} pts
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-purple-400 font-bold">
                        {item.ruleta} pts
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-black text-amber-400 text-base">
                        {item.total} pts
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. PESTAÑA: REGLAMENTO OFICIAL NTV */}
      {activeTab === 'reglamento' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-2xl">
          <div className="border-b border-slate-800 pb-5">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              DOCUMENTO NORMATIVO V1.0 • MODALIDAD INDIVIDUAL
            </span>
            <h2 className="text-2xl sm:text-3xl font-black font-serif text-white mt-1">
              Reglamento Oficial: Olimpiadas Bíblicas 2026 (NTV)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Libros evaluados: 1 Samuel, 2 Samuel, 1 Reyes, 2 Reyes en la traducción Nueva Traducción Viviente (NTV). Cada jugador compite exclusivamente para su cuenta personal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Categoría 1 */}
            <div className="p-5 bg-slate-950/60 border border-orange-500/30 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-orange-400 font-bold">
                <Flame className="w-5 h-5" />
                <h3 className="font-serif text-lg text-white">Categoría 1: FIRE QUESTIONS (Velocidad Bíblica)</h3>
              </div>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>Cada participante juega en su propia cuenta de forma individual.</li>
                <li>Ciclo ininterrumpido de <strong>90 segundos</strong>.</li>
                <li>Preguntas continuas formuladas por el sistema. El participante responde de inmediato o pulsa «PASO».</li>
                <li><strong>4 subcategorías temáticas:</strong> Personajes, Lugares, Cantidades y Eventos.</li>
                <li>Acierto = <strong>+10 puntos</strong>. Error o PASO = 0 puntos (sin penalización negativa).</li>
                <li>Tu récord personal queda registrado en la plataforma.</li>
              </ul>
            </div>

            {/* Categoría 2 */}
            <div className="p-5 bg-slate-950/60 border border-blue-500/30 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <Swords className="w-5 h-5" />
                <h3 className="font-serif text-lg text-white">Categoría 2: DAVID CONTRA GOLIAT (Desafío al Gigante)</h3>
              </div>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>Desafío individual enfrentando al Gigante Goliat.</li>
                <li><strong>20 preguntas</strong> por desafío.</li>
                <li>Uso de <strong>pulsador (honda de David)</strong>.</li>
                <li>Al presionar el pulsador se desbloquean las 4 opciones durante un reloj estricto de <strong>10 segundos</strong>.</li>
                <li>Acierto = <strong>+10 puntos</strong>. Tiempo agotado o fallo = 0 puntos.</li>
              </ul>
            </div>

            {/* Categoría 3 */}
            <div className="p-5 bg-slate-950/60 border border-emerald-500/30 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Dices className="w-5 h-5" />
                <h3 className="font-serif text-lg text-white">Categoría 3: EL DADO DADO (Suerte y Sabiduría)</h3>
              </div>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>Tanda individual de <strong>8 lanzamientos de dado por jugador</strong>.</li>
                <li>6 caras temáticas con inicio automático del temporizador de <strong>30 segundos</strong> al caer el dado.</li>
                <li>Si el reloj llega a 0, la pregunta queda anulada (0 puntos).</li>
                <li>Acierto = <strong>+10 puntos</strong> (hasta 80 puntos por tanda).</li>
              </ul>
            </div>

            {/* Categoría 4 */}
            <div className="p-5 bg-slate-950/60 border border-purple-500/30 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-purple-400 font-bold">
                <Disc className="w-5 h-5" />
                <h3 className="font-serif text-lg text-white">Categoría 4: LA RULETA (Gran Final Bíblica)</h3>
              </div>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>Tanda individual de <strong>8 giros de ruleta bíblica</strong>.</li>
                <li>Inicio automático del reloj de <strong>30 segundos</strong> tras detenerse la ruleta (mismo dinamismo que Dados).</li>
                <li>Acierto = <strong>+10 puntos</strong>. Tiempo agotado = pregunta anulada.</li>
                <li><strong>Suma Combinada:</strong> Se suman los puntos obtenidos en <em>El Dado Dado</em> + <em>La Ruleta</em>.</li>
              </ul>
            </div>
          </div>

          {/* Arbitraje Disciplinario */}
          <div className="p-5 bg-red-950/30 border border-red-500/40 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-red-400 font-bold">
              <Shield className="w-5 h-5" />
              <h3 className="font-serif text-lg text-white">Régimen Disciplinario Individual</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
              <div className="p-3 bg-slate-950/70 border border-yellow-500/30 rounded-xl">
                <strong className="text-yellow-400 block mb-1">🟨 Tarjeta Amarilla (Amonestación)</strong>
                Por faltas menores, interrupción desmedida o reclamos fuera de lugar.
              </div>
              <div className="p-3 bg-slate-950/70 border border-red-500/30 rounded-xl">
                <strong className="text-red-400 block mb-1">🟥 Tarjeta Roja (2da Amarilla o Falta Grave)</strong>
                Aplica una <strong>penalización de -100 puntos</strong> sobre el marcador acumulado del jugador.
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-700 rounded-xl">
                <strong className="text-slate-300 block mb-1">🚫 Anulación de Pregunta</strong>
                Por fallas técnicas o ambigüedades. La pregunta queda sin efecto sin penalizar al participante.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Arbitraje Disciplinario */}
      <DisciplinaryCardModal
        isOpen={disciplinaryOpen}
        onClose={() => setDisciplinaryOpen(false)}
        players={platformPlayers}
        activePlayer={disciplinaryTargetPlayer}
        onApplyCard={handleApplyDisciplinaryCard}
        onAnnulQuestion={handleAnnulQuestion}
      />

      {/* Modal de Importador de Preguntas de Fire Questions */}
      <FireQuestionsImporterModal
        isOpen={fireImporterOpen}
        onClose={() => setFireImporterOpen(false)}
      />
    </div>
  );
}
