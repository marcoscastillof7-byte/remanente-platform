import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { Users, BarChart3, BookOpen, Flame, Loader, ChevronRight, Flag, MessageSquare, Video } from 'lucide-react';

const AdminDashboard = () => {
  const { isSuperAdmin, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Group Admin can see Essays, SuperAdmin can see everything, Regular User sees nothing
  const isGroupAdmin = user?.role === 'admin';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, usersData] = await Promise.all([
          api.get('/admin/stats'),
          api.get('/admin/users'),
        ]);
        setStats(statsData);
        setUsersList(usersData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-[var(--color-gold)]" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 border-b border-gray-200 pb-6">
        <h1 className="font-[Cinzel] text-2xl md:text-3xl font-bold text-[var(--color-primary)]">🛠️ Panel</h1>
        
        {(isSuperAdmin || isGroupAdmin) && (
          <div className="flex flex-wrap items-center gap-3">
            
            {isSuperAdmin && (
              <>
                <Link to="/admin/videos" className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm text-sm font-medium">
                  <Video className="w-4 h-4" /> Videos
                </Link>
                <Link to="/admin/global-bulk" className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors shadow-sm text-sm font-medium">
                  <BookOpen className="w-4 h-4" /> Importador
                </Link>
                <Link to="/admin/suggestions" className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium">
                  <MessageSquare className="w-4 h-4" /> Sugerencias
                </Link>
                <Link to="/admin/reports" className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-danger)] text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm text-sm font-medium">
                  <Flag className="w-4 h-4" /> Reportes
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-6 h-6 text-[var(--color-primary)]" />
            <span className="text-sm text-gray-500">Total Usuarios</span>
          </div>
          <div className="text-3xl font-bold text-[var(--color-primary)]">{stats?.total_users || 0}</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-6 h-6 text-[var(--color-gold)]" />
            <span className="text-sm text-gray-500">Quizzes Completados</span>
          </div>
          <div className="text-3xl font-bold text-[var(--color-gold)]">{stats?.total_quizzes || 0}</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-6 h-6 text-[var(--color-success)]" />
            <span className="text-sm text-gray-500">Score Promedio</span>
          </div>
          <div className="text-3xl font-bold text-[var(--color-success)]">{Math.round(stats?.avg_score || 0)}%</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-3 mb-2">
            <Flame className="w-6 h-6 text-orange-500" />
            <span className="text-sm text-gray-500">Usuarios Activos</span>
          </div>
          <div className="text-3xl font-bold text-orange-500">{stats?.active_users || usersList.length}</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-md border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="font-[Cinzel] text-xl font-bold text-[var(--color-primary)]">Rendimiento de Usuarios</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-sm text-gray-500">
                <th className="px-6 py-3 text-left">Usuario</th>
                <th className="px-6 py-3 text-center">Rol</th>
                <th className="px-6 py-3 text-center">Puntos</th>
                <th className="px-6 py-3 text-center">Quizzes</th>
                <th className="px-6 py-3 text-center">Promedio</th>
                <th className="px-6 py-3 text-center">Racha</th>
                {(isSuperAdmin || isGroupAdmin) && (
                  <th className="px-6 py-3 text-center">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {usersList.map(u => {
                return (
                  <tr key={u.id} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">
                      {u.username}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${u.role === 'admin' || u.role === 'superadmin' ? 'bg-[var(--color-gold)]/20 text-[var(--color-gold-dark)] font-bold' : 'bg-gray-100 text-gray-600'}`}>
                        {u.role === 'admin' ? 'Líder' : u.role === 'superadmin' ? 'MegaAdmin' : 'Usuario'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-[var(--color-primary)]">
                      {u.points || 0}
                    </td>
                    <td className="px-6 py-4 text-center">{u.total_quizzes || 0}</td>
                    <td className="px-6 py-4 text-center font-bold">
                      <span className={`${(u.avg_score || 0) >= 80 ? 'text-[var(--color-success)]' : (u.avg_score || 0) >= 60 ? 'text-[var(--color-warning)]' : 'text-[var(--color-danger)]'}`}>
                        {Math.round(u.avg_score || 0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Flame className="w-4 h-4 text-orange-400" /> {u.current_streak || 0}
                      </span>
                    </td>
                    {(isSuperAdmin || isGroupAdmin) && (
                      <td className="px-6 py-4 text-center">
                        <Link
                          to={`/admin/users/${u.id}`}
                          className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:text-[var(--color-primary-light)] text-sm font-medium"
                        >
                          Ver Detalles <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    )}
                  </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
