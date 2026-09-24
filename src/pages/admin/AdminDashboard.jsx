import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { api } from '../../utils/api';
import { Users, BarChart3, BookOpen, Flame, Loader, ChevronRight, Flag, MessageSquare } from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, usersData] = await Promise.all([
          api.get('/admin/stats'),
          api.get('/admin/users'),
        ]);
        setStats(statsData);
        setUsers(usersData);
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
        <Loader className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <h1 className="font-[Cinzel] text-2xl md:text-3xl font-bold text-primary">👑 Panel de Administración</h1>
        <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
          <Link to="/admin/global-bulk" className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 transition-colors shadow-sm text-sm">
            <BookOpen className="w-4 h-4" /> Importador
          </Link>
          <Link to="/admin/suggestions" className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm text-sm">
            <MessageSquare className="w-4 h-4" /> Sugerencias
          </Link>
          <Link to="/admin/reports" className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-danger text-white rounded hover:bg-red-600 transition-colors shadow-sm text-sm">
            <Flag className="w-4 h-4" /> Reportes
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-6 h-6 text-primary" />
            <span className="text-sm text-gray-500">Total Usuarios</span>
          </div>
          <div className="text-3xl font-bold text-primary">{stats?.total_users || 0}</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-6 h-6 text-gold" />
            <span className="text-sm text-gray-500">Quizzes Completados</span>
          </div>
          <div className="text-3xl font-bold text-gold">{stats?.total_quizzes || 0}</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-6 h-6 text-success" />
            <span className="text-sm text-gray-500">Score Promedio</span>
          </div>
          <div className="text-3xl font-bold text-success">{Math.round(stats?.avg_score || 0)}%</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-3 mb-2">
            <Flame className="w-6 h-6 text-orange-500" />
            <span className="text-sm text-gray-500">Usuarios Activos</span>
          </div>
          <div className="text-3xl font-bold text-orange-500">{stats?.active_users || users.length}</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-md border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="font-[Cinzel] text-xl font-bold text-primary">Rendimiento de Usuarios</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-sm text-gray-500">
                <th className="px-6 py-3 text-left">Usuario</th>
                <th className="px-6 py-3 text-center">Rol</th>
                <th className="px-6 py-3 text-center">Quizzes</th>
                <th className="px-6 py-3 text-center">Promedio</th>
                <th className="px-6 py-3 text-center">Racha</th>
                <th className="px-6 py-3 text-center">Última Conexión</th>
                <th className="px-6 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                // Considerar activo si tuvo actividad en los últimos 3 minutos (180,000 ms)
                const isOnline = u.last_active && (new Date() - new Date(u.last_active)) < 3 * 60 * 1000;
                return (
                  <tr key={u.id} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} title={isOnline ? 'Activo en las últimas 24h' : 'Inactivo'}></div>
                        {u.username}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${u.role === 'admin' ? 'bg-gold/20 text-gold-dark font-bold' : 'bg-gray-100 text-gray-600'}`}>
                        {u.role === 'admin' ? 'Admin' : 'Usuario'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">{u.total_quizzes || 0}</td>
                    <td className="px-6 py-4 text-center font-bold">
                      <span className={`${(u.avg_score || 0) >= 80 ? 'text-success' : (u.avg_score || 0) >= 60 ? 'text-warning' : 'text-danger'}`}>
                        {Math.round(u.avg_score || 0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Flame className="w-4 h-4 text-orange-400" /> {u.current_streak || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">
                      {u.last_active ? new Date(u.last_active).toLocaleDateString('es') : 'Nunca'}
                    </td>
                    <td className="px-6 py-4 text-center">
                    <Link
                      to={`/admin/users/${u.id}`}
                      className="inline-flex items-center gap-1 text-primary hover:text-primary-light text-sm font-medium"
                    >
                      Ver Detalles <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
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
