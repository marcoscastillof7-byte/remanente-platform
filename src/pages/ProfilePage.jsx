import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import { User, Mail, Shield, Award, Calendar, Loader, Lock } from 'lucide-react';

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.get('/auth/profile');
        setProfileData(data);
      } catch (err) {
        console.error("Error fetching profile", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-[var(--color-gold)]" />
      </div>
    );
  }

  const { stats, achievements } = profileData || { stats: { total_quizzes: 0, avg_score: 0, current_streak: 0 }, achievements: [] };
  const unlockedCount = achievements ? achievements.filter(a => a.unlocked).length : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
        <div className="bg-[var(--color-primary)] p-8 text-white flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-[var(--color-gold)] flex items-center justify-center text-4xl font-bold uppercase border-4 border-[var(--color-parchment)] shadow-lg">
            {profileData?.username?.slice(0, 2) || 'US'}
          </div>
          <div className="text-center md:text-left">
            <h1 className="font-cinzel text-3xl font-bold">{profileData?.username}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-2 opacity-90">
              <span className="flex items-center"><Mail className="w-4 h-4 mr-1" /> {profileData?.email || 'No especificado'}</span>
              <span className="flex items-center"><Shield className="w-4 h-4 mr-1" /> {profileData?.role === 'admin' ? 'Administrador' : 'Estudiante'}</span>
            </div>
          </div>
          <button onClick={logout} className="md:ml-auto mt-4 md:mt-0 px-6 py-2 bg-red-500/20 text-red-100 rounded-md hover:bg-red-500 hover:text-white transition-colors border border-red-500/50">
            Cerrar Sesión
          </button>
        </div>

        <div className="p-8">
          <h2 className="font-cinzel text-xl font-bold text-[var(--color-primary-dark)] mb-6 flex items-center border-b pb-2">
            <Calendar className="w-5 h-5 mr-2 text-[var(--color-gold)]" /> Estadísticas Generales
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-100">
              <div className="text-3xl font-bold text-[var(--color-primary)]">{stats.total_quizzes}</div>
              <div className="text-sm text-gray-500 uppercase mt-1">Quizzes</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-100">
              <div className="text-3xl font-bold text-[var(--color-gold)]">{stats.avg_score}%</div>
              <div className="text-sm text-gray-500 uppercase mt-1">Precisión</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-100">
              <div className="text-3xl font-bold text-orange-500">{stats.current_streak}🔥</div>
              <div className="text-sm text-gray-500 uppercase mt-1">Días Seguidos</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-100">
              <div className="text-3xl font-bold text-green-500">{unlockedCount}/{achievements.length}</div>
              <div className="text-sm text-gray-500 uppercase mt-1">Logros</div>
            </div>
          </div>

          <h2 className="font-cinzel text-xl font-bold text-[var(--color-primary-dark)] mb-6 flex items-center border-b pb-2">
            <Award className="w-5 h-5 mr-2 text-[var(--color-gold)]" /> Tus Logros
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((logro) => (
              <div key={logro.id} className={`flex items-start p-4 rounded-lg border ${logro.unlocked ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                <div className="mr-4">
                  {logro.unlocked ? (
                    <Award className="w-8 h-8 text-[var(--color-gold)]" />
                  ) : (
                    <Lock className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <h3 className={`font-bold text-sm ${logro.unlocked ? 'text-yellow-900' : 'text-gray-600'}`}>{logro.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{logro.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
