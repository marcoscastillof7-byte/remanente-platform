import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { getRankInfo } from '../../utils/ranks';
import { 
  Users, BarChart3, BookOpen, Flame, Loader, ChevronRight, 
  Flag, MessageSquare, Video, Search, ArrowUpDown, Award, 
  CheckCircle2, AlertTriangle, Clock, Download, RefreshCw, 
  Trophy, Shield, Swords, Sparkles, X
} from 'lucide-react';

const AdminDashboard = () => {
  const { isSuperAdmin, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [sortBy, setSortBy] = useState('points_desc');
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [onlineCount, setOnlineCount] = useState(1);

  const isGroupAdmin = user?.role === 'admin';

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [statsData, usersData] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
      ]);
      setStats(statsData);
      setUsersList(usersData || []);
    } catch (err) {
      console.error('Error cargando datos de administración:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Sincronización en tiempo real de presencia de usuarios
    const handleOnlineUpdate = (e) => {
      if (e?.detail) {
        if (typeof e.detail.onlineCount === 'number') {
          setOnlineCount(Math.max(1, e.detail.onlineCount));
        }
        if (Array.isArray(e.detail.users)) {
          setOnlineUserIds(new Set(e.detail.users.map(u => String(u.id))));
        }
      }
    };

    window.addEventListener('platform-online-update', handleOnlineUpdate);

    // Consulta inicial rápida a /stats/online
    api.get('/stats/online').then(res => {
      if (res) {
        if (typeof res.onlineCount === 'number') setOnlineCount(Math.max(1, res.onlineCount));
        if (Array.isArray(res.users)) setOnlineUserIds(new Set(res.users.map(u => String(u.id))));
      }
    }).catch(() => {});

    return () => window.removeEventListener('platform-online-update', handleOnlineUpdate);
  }, []);

  // Función de cálculo de inactividad
  const isInactiveUser = (lastActiveDate) => {
    if (!lastActiveDate) return true;
    const diffDays = (new Date() - new Date(lastActiveDate)) / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  };

  // Conteo para los chips de filtro
  const filterCounts = useMemo(() => {
    return {
      all: usersList.length,
      onlineNow: usersList.filter(u => onlineUserIds.has(String(u.id))).length,
      excellent: usersList.filter(u => (u.avg_score || 0) >= 80).length,
      progress: usersList.filter(u => (u.avg_score || 0) >= 60 && (u.avg_score || 0) < 80).length,
      support: usersList.filter(u => (u.total_quizzes > 0 && (u.avg_score || 0) < 60) || u.total_quizzes === 0).length,
      activeStreak: usersList.filter(u => (u.current_streak || 0) > 0).length,
      inactive: usersList.filter(u => isInactiveUser(u.last_active)).length,
      students: usersList.filter(u => u.role === 'user').length,
      leaders: usersList.filter(u => u.role === 'admin' || u.role === 'superadmin').length
    };
  }, [usersList, onlineUserIds]);

  // Filtrado y ordenación
  const filteredUsers = useMemo(() => {
    let list = [...usersList];

    // 1. Búsqueda por nombre o correo
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(u => 
        (u.username && u.username.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term))
      );
    }

    // 2. Filtro por estado/pestaña
    if (filterTab === 'onlineNow') {
      list = list.filter(u => onlineUserIds.has(String(u.id)));
    } else if (filterTab === 'excellent') {
      list = list.filter(u => (u.avg_score || 0) >= 80);
    } else if (filterTab === 'progress') {
      list = list.filter(u => (u.avg_score || 0) >= 60 && (u.avg_score || 0) < 80);
    } else if (filterTab === 'support') {
      list = list.filter(u => (u.total_quizzes > 0 && (u.avg_score || 0) < 60) || u.total_quizzes === 0);
    } else if (filterTab === 'activeStreak') {
      list = list.filter(u => (u.current_streak || 0) > 0);
    } else if (filterTab === 'inactive') {
      list = list.filter(u => isInactiveUser(u.last_active));
    } else if (filterTab === 'students') {
      list = list.filter(u => u.role === 'user');
    } else if (filterTab === 'leaders') {
      list = list.filter(u => u.role === 'admin' || u.role === 'superadmin');
    }

    // 3. Ordenamiento
    list.sort((a, b) => {
      switch (sortBy) {
        case 'points_desc':
          return (b.points || 0) - (a.points || 0);
        case 'points_asc':
          return (a.points || 0) - (b.points || 0);
        case 'avg_desc':
          return (b.avg_score || 0) - (a.avg_score || 0);
        case 'avg_asc':
          return (a.avg_score || 0) - (b.avg_score || 0);
        case 'quizzes_desc':
          return (b.total_quizzes || 0) - (a.total_quizzes || 0);
        case 'streak_desc':
          return (b.current_streak || 0) - (a.current_streak || 0);
        case 'active_desc': {
          const dateA = a.last_active ? new Date(a.last_active).getTime() : 0;
          const dateB = b.last_active ? new Date(b.last_active).getTime() : 0;
          return dateB - dateA;
        }
        case 'name_asc':
          return (a.username || '').localeCompare(b.username || '');
        default:
          return (b.points || 0) - (a.points || 0);
      }
    });

    return list;
  }, [usersList, searchTerm, filterTab, sortBy]);

  // Exportar reporte a CSV
  const exportToCSV = () => {
    if (!usersList || usersList.length === 0) return;

    const headers = [
      'ID',
      'Usuario',
      'Email',
      'Rol',
      'Puntos Bíblicos',
      'Rango',
      'Quizzes Totales',
      'Quizzes Aprobados',
      'Tasa Aprobación (%)',
      'Promedio Score (%)',
      'Racha Actual (días)',
      'Racha Récord (días)',
      'Supervivencia Máx',
      'Duelos Ganados',
      'Última Actividad'
    ];

    const rows = filteredUsers.map(u => {
      const rank = getRankInfo(u.points);
      return [
        u.id,
        `"${(u.username || '').replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`,
        u.role === 'superadmin' ? 'Superadmin' : u.role === 'admin' ? 'Líder' : 'Estudiante',
        u.points || 0,
        `"${rank.name}"`,
        u.total_quizzes || 0,
        u.passed_quizzes || 0,
        u.pass_rate || 0,
        Math.round(u.avg_score || 0),
        u.current_streak || 0,
        u.longest_streak || 0,
        u.survival_best || 0,
        u.duels_won || 0,
        u.last_active ? new Date(u.last_active).toLocaleString('es') : 'Sin actividad'
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_rendimiento_remanente_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatRelativeActivity = (dateStr) => {
    if (!dateStr) return { text: 'Nunca', status: 'gray' };
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = (now - date) / (1000 * 60 * 60);

    if (diffHours < 24 && now.getDate() === date.getDate()) {
      return { text: 'Hoy', status: 'green' };
    }
    if (diffHours < 48) {
      return { text: 'Ayer', status: 'green' };
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays <= 7) {
      return { text: `Hace ${diffDays} d`, status: 'yellow' };
    }
    return { text: date.toLocaleDateString('es', { day: '2-digit', month: 'short' }), status: 'gray' };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader className="w-10 h-10 animate-spin text-[var(--color-gold)]" />
        <p className="text-gray-500 font-medium animate-pulse">Cargando panel de rendimiento bíblico...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Encabezado Principal */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg">
                <Shield className="w-6 h-6" />
              </span>
              <h1 className="font-[Cinzel] text-2xl sm:text-3xl font-bold text-[var(--color-primary)]">
                Panel de Rendimiento Estudiantil
              </h1>
            </div>
            <p className="text-gray-600 text-sm max-w-2xl">
              Supervisa el avance bíblico, calificaciones en quizzes, rachas de estudio y constancia de cada persona en tu congregación.
            </p>
          </div>

          {/* Acciones Rápidas */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              title="Recargar datos"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[var(--color-gold)]' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              title="Descargar reporte en Excel / CSV"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>

            {isSuperAdmin && (
              <>
                <Link to="/admin/global-bulk" className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
                  <BookOpen className="w-4 h-4" />
                  <span>Importador</span>
                </Link>
                <Link to="/admin/reports" className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
                  <Flag className="w-4 h-4" />
                  <span>Reportes</span>
                </Link>
                <Link to="/admin/suggestions" className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
                  <MessageSquare className="w-4 h-4" />
                  <span>Sugerencias</span>
                </Link>
                <Link to="/admin/videos" className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
                  <Video className="w-4 h-4" />
                  <span>Videos</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI Global Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        
        {/* Total Estudiantes */}
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Estudiantes</span>
            <Users className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--color-primary)]">
              {stats?.total_users || usersList.length}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              {filterCounts.students} activos en el grupo
            </div>
          </div>
        </div>

        {/* Sabiduría Total (Puntos) */}
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Sabiduría Total</span>
            <Trophy className="w-4 h-4 text-[var(--color-gold)]" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--color-gold-dark)]">
              {(stats?.total_points || usersList.reduce((sum, u) => sum + (u.points || 0), 0)).toLocaleString()}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Puntos acumulados
            </div>
          </div>
        </div>

        {/* Quizzes Completados */}
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Exámenes</span>
            <BookOpen className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-600">
              {stats?.total_quizzes || 0}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Intentos completados
            </div>
          </div>
        </div>

        {/* Promedio General */}
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Promedio</span>
            <BarChart3 className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {Math.round(stats?.avg_score || 0)}%
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Acierto global del grupo
            </div>
          </div>
        </div>

        {/* Tasa de Aprobación */}
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Aprobación</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-600">
              {stats?.pass_rate !== undefined ? `${stats.pass_rate}%` : '85%'}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Notas ≥ 80%
            </div>
          </div>
        </div>

        {/* Usuarios En Línea Ahora Mismo */}
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-emerald-300 bg-gradient-to-br from-emerald-50/50 via-white to-white flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">En Línea Ahora</span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {Math.max(onlineUserIds.size, onlineCount)}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Conexión en vivo activa
            </div>
          </div>
        </div>

      </div>

      {/* Barra de Filtros, Búsqueda y Ordenamiento */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
        
        {/* Fila Superior: Buscador y Ordenamiento */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Input de Búsqueda */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar estudiante por nombre o correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Selector de Orden */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" /> Ordenar:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-xs sm:text-sm font-medium text-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
            >
              <option value="points_desc">Mayor Puntuación (Puntos)</option>
              <option value="points_asc">Menor Puntuación</option>
              <option value="avg_desc">Mayor Promedio (% Acierto)</option>
              <option value="avg_asc">Menor Promedio</option>
              <option value="quizzes_desc">Más Quizzes Realizados</option>
              <option value="streak_desc">Mayor Racha Actual</option>
              <option value="active_desc">Actividad Más Reciente</option>
              <option value="name_asc">Nombre Alfabético (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Fila Inferior: Chips de Filtro por Desempeño */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterTab === 'all'
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            👥 Todos <span className="opacity-75">({filterCounts.all})</span>
          </button>

          <button
            onClick={() => setFilterTab('onlineNow')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterTab === 'onlineNow'
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>En Línea Ahora</span>
            <span className="opacity-90 font-bold">({filterCounts.onlineNow || onlineUserIds.size})</span>
          </button>

          <button
            onClick={() => setFilterTab('excellent')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterTab === 'excellent'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            🌟 Sobresalientes (≥80%) <span className="opacity-75">({filterCounts.excellent})</span>
          </button>

          <button
            onClick={() => setFilterTab('progress')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterTab === 'progress'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            📖 En Progreso (60-79%) <span className="opacity-75">({filterCounts.progress})</span>
          </button>

          <button
            onClick={() => setFilterTab('support')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterTab === 'support'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            ⚠️ Requieren Apoyo (&lt;60%) <span className="opacity-75">({filterCounts.support})</span>
          </button>

          <button
            onClick={() => setFilterTab('activeStreak')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterTab === 'activeStreak'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
          >
            🔥 Con Racha Activa <span className="opacity-75">({filterCounts.activeStreak})</span>
          </button>

          <button
            onClick={() => setFilterTab('inactive')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterTab === 'inactive'
                ? 'bg-gray-700 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            💤 Inactivos (&gt;7d) <span className="opacity-75">({filterCounts.inactive})</span>
          </button>

          <button
            onClick={() => setFilterTab('students')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterTab === 'students'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            🎓 Solo Estudiantes <span className="opacity-75">({filterCounts.students})</span>
          </button>
        </div>

      </div>

      {/* Tabla Principal de Estudiantes */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-[Cinzel] text-lg font-bold text-[var(--color-primary)]">
              Expedientes de Rendimiento
            </h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-medium">
              Mostrando {filteredUsers.length} de {usersList.length}
            </span>
          </div>

          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); setFilterTab('all'); }}
              className="text-xs text-[var(--color-primary)] hover:underline font-medium"
            >
              Restablecer filtros
            </button>
          )}
        </div>

        {filteredUsers.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="font-[Cinzel] text-lg font-bold text-gray-700 mb-1">
              No se encontraron estudiantes
            </h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
              Ningún usuario coincide con los criterios de búsqueda o los filtros seleccionados.
            </p>
            <button
              onClick={() => { setSearchTerm(''); setFilterTab('all'); }}
              className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium hover:bg-[var(--color-primary-light)] transition-colors"
            >
              Ver todos los estudiantes
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                  <th className="px-5 py-3.5">Estudiante & Rango</th>
                  <th className="px-4 py-3.5 text-center">Puntos Bíblicos</th>
                  <th className="px-4 py-3.5 text-center">Quizzes</th>
                  <th className="px-4 py-3.5 text-center">Tasa Aprobación</th>
                  <th className="px-4 py-3.5 text-center">Promedio</th>
                  <th className="px-4 py-3.5 text-center">Racha</th>
                  <th className="px-4 py-3.5 text-center">Supervivencia / Duelos</th>
                  <th className="px-4 py-3.5 text-center">Última Actividad</th>
                  <th className="px-5 py-3.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredUsers.map((u, index) => {
                  const rank = getRankInfo(u.points);
                  const activity = formatRelativeActivity(u.last_active);
                  const isLeader = u.role === 'admin' || u.role === 'superadmin';
                  const isOnline = onlineUserIds.has(String(u.id));
                  const passRate = u.pass_rate !== undefined ? u.pass_rate : (u.total_quizzes > 0 ? Math.round(((u.passed_quizzes || 0) / u.total_quizzes) * 100) : 0);

                  return (
                    <tr 
                      key={u.id} 
                      className={`transition-colors group ${
                        isOnline ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'hover:bg-amber-50/30'
                      }`}
                    >
                      
                      {/* Estudiante & Rango */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-primary-light)] text-white font-bold flex items-center justify-center text-sm shadow-sm transition-all ${
                              isOnline ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-white' : ''
                            }`}>
                              {(u.username || 'U').substring(0, 2).toUpperCase()}
                            </div>
                            {isOnline && (
                              <span className="absolute -top-1 -right-1 flex h-3 w-3" title="Conectado en vivo ahora">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white"></span>
                              </span>
                            )}
                            <span 
                              className="absolute -bottom-1 -right-1 text-xs" 
                              title={`Rango: ${rank.name}`}
                            >
                              {rank.icon}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 group-hover:text-[var(--color-primary)] transition-colors">
                                {u.username}
                              </span>
                              {isOnline && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  En vivo
                                </span>
                              )}
                              {isLeader && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  {u.role === 'superadmin' ? 'Superadmin' : 'Líder'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                              <span className="truncate max-w-[150px]">{u.email || 'Sin correo'}</span>
                              <span className="text-gray-300">•</span>
                              <span className={`font-medium ${rank.color}`}>{rank.name}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Puntos Bíblicos */}
                      <td className="px-4 py-4 text-center">
                        <span className="font-extrabold text-[var(--color-primary)] text-base">
                          {(u.points || 0).toLocaleString()}
                        </span>
                        <div className="text-[10px] text-gray-400 font-medium">sabiduría</div>
                      </td>

                      {/* Quizzes Totales y Aprobados */}
                      <td className="px-4 py-4 text-center">
                        <div className="font-semibold text-gray-800">
                          {u.total_quizzes || 0}
                        </div>
                        <div className="text-[11px] text-emerald-600 font-medium">
                          {u.passed_quizzes || 0} aprobados
                        </div>
                      </td>

                      {/* Tasa de Aprobación */}
                      <td className="px-4 py-4 text-center min-w-[120px]">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <span className={`text-xs font-bold ${
                            passRate >= 80 ? 'text-emerald-600' : passRate >= 60 ? 'text-amber-600' : 'text-rose-500'
                          }`}>
                            {passRate}%
                          </span>
                        </div>
                        <div className="w-20 mx-auto bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              passRate >= 80 ? 'bg-emerald-500' : passRate >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, passRate)}%` }}
                          />
                        </div>
                      </td>

                      {/* Promedio General */}
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          (u.avg_score || 0) >= 80 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : (u.avg_score || 0) >= 60 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {Math.round(u.avg_score || 0)}%
                        </span>
                      </td>

                      {/* Racha de Estudio */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1 font-bold text-gray-800">
                          <Flame className={`w-4 h-4 ${u.current_streak > 0 ? 'text-orange-500 animate-pulse' : 'text-gray-300'}`} />
                          <span>{u.current_streak || 0} d</span>
                        </div>
                        <div className="text-[10px] text-gray-400">
                          récord: {u.longest_streak || u.current_streak || 0} d
                        </div>
                      </td>

                      {/* Supervivencia & Duelos */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-3 text-xs">
                          <span className="flex items-center gap-1 font-medium text-purple-700" title="Récord Supervivencia">
                            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                            {u.survival_best || 0} pts
                          </span>
                          <span className="flex items-center gap-1 font-medium text-blue-700" title="Duelos Ganados">
                            <Swords className="w-3.5 h-3.5 text-blue-500" />
                            {u.duels_won || 0} V
                          </span>
                        </div>
                      </td>

                      {/* Última Actividad */}
                      <td className="px-4 py-4 text-center">
                        {isOnline ? (
                          <div className="flex items-center justify-center gap-1.5" title="Conectado en tiempo real">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 shadow-xs">
                              En línea
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${
                              activity.status === 'green' 
                                ? 'bg-emerald-500 ring-4 ring-emerald-100' 
                                : activity.status === 'yellow' 
                                ? 'bg-amber-500' 
                                : 'bg-gray-300'
                            }`} />
                            <span className="text-xs font-medium text-gray-600">
                              {activity.text}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Acción */}
                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/admin/users/${u.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--color-parchment)] hover:bg-[var(--color-primary)] text-[var(--color-primary)] hover:text-white rounded-lg text-xs font-semibold transition-all shadow-sm border border-amber-200 hover:border-transparent"
                        >
                          <span>Expediente</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer de la Tabla */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
          <div>
            💡 Haz clic en <strong>Expediente</strong> para ver el historial detallado de capítulos, intentos y logros de cada estudiante.
          </div>
          <div className="font-medium">
            Total {filteredUsers.length} estudiantes registrados
          </div>
        </div>

      </div>

    </div>
  );
};

export default AdminDashboard;
