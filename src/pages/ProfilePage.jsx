import { useAuth } from '../hooks/useAuth';
import { User, Mail, Shield, Award, Calendar } from 'lucide-react';

const ProfilePage = () => {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
        <div className="bg-[var(--color-primary)] p-8 text-white flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-[var(--color-gold)] flex items-center justify-center text-4xl font-bold uppercase border-4 border-[var(--color-parchment)] shadow-lg">
            {user?.username?.slice(0, 2) || 'US'}
          </div>
          <div className="text-center md:text-left">
            <h1 className="font-cinzel text-3xl font-bold">{user?.username}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-2 opacity-90">
              <span className="flex items-center"><Mail className="w-4 h-4 mr-1" /> {user?.email || 'No especificado'}</span>
              <span className="flex items-center"><Shield className="w-4 h-4 mr-1" /> {user?.role === 'admin' ? 'Administrador' : 'Estudiante'}</span>
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
              <div className="text-3xl font-bold text-[var(--color-primary)]">150</div>
              <div className="text-sm text-gray-500 uppercase mt-1">Quizzes</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-100">
              <div className="text-3xl font-bold text-[var(--color-gold)]">85%</div>
              <div className="text-sm text-gray-500 uppercase mt-1">Precisión</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-100">
              <div className="text-3xl font-bold text-orange-500">12🔥</div>
              <div className="text-sm text-gray-500 uppercase mt-1">Días Seguidos</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-100">
              <div className="text-3xl font-bold text-green-500">5</div>
              <div className="text-sm text-gray-500 uppercase mt-1">Logros</div>
            </div>
          </div>

          <h2 className="font-cinzel text-xl font-bold text-[var(--color-primary-dark)] mb-6 flex items-center border-b pb-2">
            <Award className="w-5 h-5 mr-2 text-[var(--color-gold)]" /> Logros Desbloqueados
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {['Primer Quiz', 'Racha de 7 días', 'Maestro de 1 Samuel', 'Precisión Perfecta'].map((logro, i) => (
              <div key={i} className="flex flex-col items-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <Award className="w-10 h-10 text-[var(--color-gold)] mb-2" />
                <span className="text-sm font-medium text-center text-yellow-900">{logro}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
