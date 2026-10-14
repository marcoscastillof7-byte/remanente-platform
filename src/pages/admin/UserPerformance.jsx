import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { api } from '../../utils/api';
import { getRankInfo } from '../../utils/ranks';
import { 
  ArrowLeft, Loader, BookOpen, Target, Flame, Trophy, 
  CheckCircle2, AlertCircle, Clock, Calendar, Award, 
  Swords, Sparkles, BookMarked, Layers, ChevronDown, 
  ChevronUp, User, ShieldCheck, Mail, Check, X
} from 'lucide-react';

const UserPerformance = () => {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('books'); // 'books' | 'history' | 'achievements' | 'games'
  const [expandedBooks, setExpandedBooks] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await api.get(`/admin/users/${userId}/performance`);
        setData(result);
        // Expandir por defecto el primer libro
        if (result?.books && result.books.length > 0) {
          setExpandedBooks({ [result.books[0].id || 1]: true });
        }
      } catch (err) {
        console.error('Error cargando expediente del estudiante:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const toggleBook = (bookId) => {
    setExpandedBooks(prev => ({
      ...prev,
      [bookId]: !prev[bookId]
    }));
  };

  const expandAllBooks = () => {
    if (!data?.books) return;
    const all = {};
    data.books.forEach(b => { all[b.id] = true; });
    setExpandedBooks(all);
  };

  const collapseAllBooks = () => {
    setExpandedBooks({});
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader className="w-10 h-10 animate-spin text-[var(--color-gold)]" />
        <p className="text-gray-500 font-medium animate-pulse">Cargando expediente bíblico del estudiante...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
          <User className="w-8 h-8" />
        </div>
        <h2 className="font-[Cinzel] text-xl font-bold text-gray-800 mb-2">Estudiante no encontrado</h2>
        <p className="text-sm text-gray-500 mb-6">No se pudo recuperar la información de este usuario o no pertenece a tu congregación.</p>
        <Link 
          to="/admin" 
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium hover:bg-[var(--color-primary-light)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Panel
        </Link>
      </div>
    );
  }

  const rank = getRankInfo(data.points);
  const isLeader = data.role === 'admin' || data.role === 'superadmin';

  // Cálculos de progreso global de libros
  const totalChaptersAllBooks = data.books?.reduce((sum, b) => sum + (b.chapters_count || 0), 0) || 102;
  const passedChaptersAllBooks = data.books?.reduce((sum, b) => sum + (b.chapters_passed || 0), 0) || 0;
  const overallGlobalProgress = Math.round((passedChaptersAllBooks / totalChaptersAllBooks) * 100);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Botón Volver */}
      <div>
        <Link 
          to="/admin" 
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-light)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Panel de Rendimiento
        </Link>
      </div>

      {/* Banner de Perfil del Estudiante */}
      <div className="bg-gradient-to-r from-[#172e4d] via-[var(--color-primary)] to-[#172e4d] rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden border border-white/10">
        
        {/* Adorno decorativo de fondo */}
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <Trophy className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          {/* Identidad del Estudiante */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 backdrop-blur-sm border-2 border-[var(--color-gold)] flex items-center justify-center font-[Cinzel] text-2xl sm:text-3xl font-bold text-[var(--color-gold)] shadow-md">
                {(data.username || 'U').substring(0, 2).toUpperCase()}
              </div>
              <span className="absolute -bottom-1 -right-1 text-2xl" title={`Rango: ${rank.name}`}>
                {rank.icon}
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-[Cinzel] text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  {data.username}
                </h1>
                {isLeader && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--color-gold)]/20 text-[var(--color-gold-light)] border border-[var(--color-gold)]/40 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {data.role === 'superadmin' ? 'Superadmin' : 'Líder'}
                  </span>
                )}
                {data.group_name && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-200 border border-white/20">
                    {data.group_name}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-300">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  {data.email || 'Sin correo registrado'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  Miembro desde: {data.created_at ? new Date(data.created_at).toLocaleDateString('es', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  Última actividad: {data.last_active ? new Date(data.last_active).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta de Rango Bíblico & Sabiduría */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 sm:p-5 flex items-center gap-4 self-start md:self-auto min-w-[240px]">
            <div className="text-4xl">{rank.icon}</div>
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-300 font-semibold">Rango Bíblico</div>
              <div className="font-[Cinzel] text-xl font-bold text-[var(--color-gold-light)]">{rank.name}</div>
              <div className="text-sm font-extrabold text-white mt-0.5">
                {(data.points || 0).toLocaleString()} <span className="text-xs font-normal text-gray-300">pts sabiduría</span>
              </div>
              {rank.next && (
                <div className="text-[10px] text-gray-400 mt-1">
                  Próximo rango a los {(rank.next).toLocaleString()} pts
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Tarjetas de Métricas Clave (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        
        {/* Quizzes Totales */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase">Quizzes</span>
            <BookOpen className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{data.total_quizzes || 0}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
            {data.passed_quizzes || 0} aprobados ({data.pass_rate || 0}%)
          </div>
        </div>

        {/* Promedio General */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase">Promedio</span>
            <Target className="w-4 h-4 text-emerald-500" />
          </div>
          <div className={`text-2xl font-bold ${
            (data.avg_score || 0) >= 80 ? 'text-emerald-600' : (data.avg_score || 0) >= 60 ? 'text-amber-600' : 'text-rose-600'
          }`}>
            {Math.round(data.avg_score || 0)}%
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            Acierto global
          </div>
        </div>

        {/* Racha de Estudio */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase">Racha</span>
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-orange-500 flex items-center gap-1">
            {data.current_streak || 0} <span className="text-sm text-gray-500 font-normal">días</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            Récord: {data.longest_streak || data.current_streak || 0} días
          </div>
        </div>

        {/* Dominio de Libros */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase">Capítulos</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            {passedChaptersAllBooks} <span className="text-xs text-gray-400 font-normal">/ {totalChaptersAllBooks}</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5 font-medium">
            {overallGlobalProgress}% completado
          </div>
        </div>

        {/* Supervivencia */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase">Supervivencia</span>
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-700">
            {data.survival?.best_score || 0} <span className="text-xs text-gray-400 font-normal">pts</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {data.survival?.games_played || 0} partidas jugadas
          </div>
        </div>

        {/* Duelos Bíblicos */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase">Duelos</span>
            <Swords className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {data.duels?.won || 0} <span className="text-xs text-gray-400 font-normal">victorias</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {data.duels?.played || 0} jugados ({data.duels?.win_rate || 0}% WR)
          </div>
        </div>

      </div>

      {/* Pestañas de Navegación del Expediente */}
      <div className="flex border-b border-gray-200 space-x-1 sm:space-x-4 overflow-x-auto scrollbar-thin">
        
        <button
          onClick={() => setActiveTab('books')}
          className={`py-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'books'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Dominio por Libros y Capítulos</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Historial de Exámenes ({data.recent_attempts?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('achievements')}
          className={`py-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'achievements'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Logros Desbloqueados ({data.achievements?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('games')}
          className={`py-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'games'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Swords className="w-4 h-4" />
          <span>Duelos & Supervivencia</span>
        </button>

      </div>

      {/* CONTENIDO DE PESTAÑAS */}

      {/* 1. DOMINIO POR LIBROS Y CAPÍTULOS */}
      {activeTab === 'books' && (
        <div className="space-y-6">
          
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm text-gray-500">
              Desglose detallado del progreso del estudiante en cada libro del Remanente.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={expandAllBooks}
                className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
              >
                Expandir todos
              </button>
              <span className="text-gray-300">•</span>
              <button
                onClick={collapseAllBooks}
                className="text-xs font-semibold text-gray-500 hover:underline"
              >
                Colapsar todos
              </button>
            </div>
          </div>

          {data.books && data.books.map(book => {
            const isExpanded = expandedBooks[book.id];
            const percent = book.completion_percentage || 0;

            return (
              <div 
                key={book.id || book.name} 
                className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* Cabecera del Libro (Acordeón) */}
                <div 
                  onClick={() => toggleBook(book.id)}
                  className="p-5 sm:p-6 bg-gradient-to-r from-amber-50/50 to-white border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-amber-50/80 transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-2.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-xl">
                      <BookOpen className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="font-[Cinzel] font-bold text-lg sm:text-xl text-[var(--color-primary)]">
                        {book.name}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {book.description || `Estudio de los ${book.chapters_count} capítulos`}
                      </p>
                    </div>
                  </div>

                  {/* Estadísticas de Libro */}
                  <div className="flex items-center gap-4 sm:gap-6 self-end md:self-auto">
                    
                    <div className="text-right">
                      <div className="text-xs text-gray-400 uppercase font-semibold">Aprobados</div>
                      <div className="text-sm font-bold text-gray-800">
                        {book.chapters_passed || 0} / {book.chapters_count}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-gray-400 uppercase font-semibold">Promedio</div>
                      <div className={`text-sm font-bold ${
                        (book.avg_score || 0) >= 80 ? 'text-emerald-600' : (book.avg_score || 0) >= 60 ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        {book.avg_score ? `${Math.round(book.avg_score)}%` : 'Sin datos'}
                      </div>
                    </div>

                    {/* Barra de Progreso del Libro */}
                    <div className="w-24 sm:w-32 hidden sm:block">
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span className="text-gray-500">Avance</span>
                        <span className="text-[var(--color-primary)]">{percent}%</span>
                      </div>
                      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-primary)] rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-gray-400">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>

                  </div>
                </div>

                {/* Tabla de Capítulos (Visible si expandido) */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                          <th className="px-5 py-3">Capítulo</th>
                          <th className="px-4 py-3 text-center">Estado</th>
                          <th className="px-4 py-3 text-center">Intentos</th>
                          <th className="px-4 py-3 text-center">Mejor Score</th>
                          <th className="px-4 py-3 text-center">Promedio</th>
                          <th className="px-5 py-3 text-right">Último Examen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {book.chapters && book.chapters.map(ch => {
                          const hasAttempts = (ch.attempts || 0) > 0;
                          const isPassed = ch.best_score !== null && ch.best_score >= 80;

                          return (
                            <tr key={ch.chapter_id || ch.chapter_number} className="hover:bg-gray-50/60 transition-colors">
                              
                              {/* Capítulo */}
                              <td className="px-5 py-3.5">
                                <div className="font-semibold text-gray-800">
                                  Capítulo {ch.chapter_number}
                                </div>
                                {ch.title && (
                                  <div className="text-xs text-gray-400 line-clamp-1">
                                    {ch.title}
                                  </div>
                                )}
                              </td>

                              {/* Estado */}
                              <td className="px-4 py-3.5 text-center">
                                {isPassed ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                    <Check className="w-3 h-3" /> Aprobado
                                  </span>
                                ) : hasAttempts ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                    En Progreso
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                    Sin iniciar
                                  </span>
                                )}
                              </td>

                              {/* Intentos */}
                              <td className="px-4 py-3.5 text-center font-medium text-gray-700">
                                {ch.attempts || 0}
                              </td>

                              {/* Mejor Score */}
                              <td className="px-4 py-3.5 text-center">
                                {ch.best_score !== null && ch.best_score !== undefined ? (
                                  <span className={`font-bold text-sm ${
                                    ch.best_score >= 80 ? 'text-emerald-600' : ch.best_score >= 60 ? 'text-amber-600' : 'text-rose-600'
                                  }`}>
                                    {ch.best_score}%
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>

                              {/* Promedio */}
                              <td className="px-4 py-3.5 text-center">
                                {ch.avg_score !== null && ch.avg_score !== undefined ? (
                                  <span className="text-gray-700 font-medium text-xs">
                                    {Math.round(ch.avg_score)}%
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>

                              {/* Último Examen */}
                              <td className="px-5 py-3.5 text-right text-xs text-gray-500">
                                {ch.last_attempt ? (
                                  <span>{new Date(ch.last_attempt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            );
          })}

        </div>
      )}

      {/* 2. HISTORIAL RECIENTE DE EXÁMENES */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-[Cinzel] font-bold text-lg text-[var(--color-primary)]">
              Últimos Exámenes Realizados
            </h3>
            <span className="text-xs text-gray-400">
              Mostrando los {data.recent_attempts?.length || 0} intentos más recientes
            </span>
          </div>

          {!data.recent_attempts || data.recent_attempts.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              Este estudiante aún no ha completado ningún examen.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                    <th className="px-5 py-3.5">Libro & Capítulo</th>
                    <th className="px-4 py-3.5 text-center">Calificación</th>
                    <th className="px-4 py-3.5 text-center">Resultado</th>
                    <th className="px-5 py-3.5 text-right">Fecha y Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.recent_attempts.map((att) => {
                    const isPassed = (att.score || 0) >= 80;

                    return (
                      <tr key={att.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-gray-800">
                            {att.book_name} — Cap. {att.chapter_number}
                          </div>
                          {att.chapter_title && (
                            <div className="text-xs text-gray-400 line-clamp-1">{att.chapter_title}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`font-extrabold text-base ${
                            isPassed ? 'text-emerald-600' : (att.score || 0) >= 60 ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {att.score}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {isPassed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {isPassed ? 'Aprobado' : 'Requiere Repaso'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs text-gray-500">
                          {att.completed_at ? new Date(att.completed_at).toLocaleString('es', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          }) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. LOGROS DESBLOQUEADOS */}
      {activeTab === 'achievements' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-[Cinzel] font-bold text-xl text-[var(--color-primary)]">
                Insignias y Logros Bíblicos
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Reconocimientos alcanzados por la fidelidad y constancia en el estudio.
              </p>
            </div>
            <div className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold flex items-center gap-1">
              <Award className="w-4 h-4 text-amber-600" />
              <span>{data.achievements?.length || 0} Desbloqueados</span>
            </div>
          </div>

          {!data.achievements || data.achievements.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              El estudiante aún no ha desbloqueado insignias. A medida que complete quizzes y mantenga su racha, irán apareciendo aquí.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.achievements.map((ach) => (
                <div 
                  key={ach.id} 
                  className="bg-gradient-to-b from-amber-50/40 to-white border border-amber-200/60 rounded-xl p-5 text-center flex flex-col items-center justify-between hover:shadow-md transition-shadow"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-100 to-amber-50 flex items-center justify-center text-3xl mb-3 shadow-inner border border-amber-200">
                    {ach.icon || '🏆'}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm mb-1">{ach.name}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">{ach.description}</p>
                  </div>
                  <div className="text-[10px] text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-full mt-3 font-medium">
                    Desbloqueado: {ach.earned_at ? new Date(ach.earned_at).toLocaleDateString('es') : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. DUELOS & SUPERVIVENCIA */}
      {activeTab === 'games' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Tarjeta de Supervivencia */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <span className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                <Sparkles className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-[Cinzel] font-bold text-lg text-gray-900">Modo Supervivencia</h3>
                <p className="text-xs text-gray-500">Resistencia y conocimiento sin fallas</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-purple-50/60 rounded-xl p-4 border border-purple-100 text-center">
                <div className="text-xs font-semibold text-purple-800 uppercase">Récord Máximo</div>
                <div className="text-3xl font-extrabold text-purple-900 mt-1">
                  {data.survival?.best_score || 0}
                </div>
                <div className="text-[11px] text-purple-600 mt-0.5">preguntas seguidas</div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                <div className="text-xs font-semibold text-gray-600 uppercase">Partidas Jugadas</div>
                <div className="text-3xl font-extrabold text-gray-800 mt-1">
                  {data.survival?.games_played || 0}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">intentos en total</div>
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              El modo supervivencia otorga 10 puntos de sabiduría por cada respuesta acertada hasta cometer el primer error.
            </p>
          </div>

          {/* Tarjeta de Duelos Bíblicos */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <span className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                <Swords className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-[Cinzel] font-bold text-lg text-gray-900">Duelos 1 vs 1</h3>
                <p className="text-xs text-gray-500">Enfrentamientos en tiempo real contra hermanos</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-amber-50/60 rounded-xl p-3 border border-amber-100 text-center">
                <div className="text-xs font-semibold text-amber-800 uppercase">Jugados</div>
                <div className="text-2xl font-extrabold text-gray-800 mt-1">
                  {data.duels?.played || 0}
                </div>
              </div>

              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-center">
                <div className="text-xs font-semibold text-emerald-800 uppercase">Victorias</div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                  {data.duels?.won || 0}
                </div>
              </div>

              <div className="bg-rose-50 rounded-xl p-3 border border-rose-100 text-center">
                <div className="text-xs font-semibold text-rose-800 uppercase">Derrotas</div>
                <div className="text-2xl font-extrabold text-rose-700 mt-1">
                  {data.duels?.lost || 0}
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-600">Efectividad de Victoria (WR):</span>
              <span className="font-bold text-sm text-[var(--color-primary)]">
                {data.duels?.win_rate || 0}%
              </span>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default UserPerformance;
