import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { User, Lock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-primary-dark)] px-4">
      <div className="w-full max-w-md bg-[var(--color-parchment)] p-8 rounded-xl shadow-2xl border-2 border-[var(--color-gold)]">
        <div className="text-center mb-8">
          <h1 className="font-cinzel text-3xl font-bold text-[var(--color-primary)] mb-2">📖 Remanente</h1>
          <p className="text-gray-600 font-medium">Plataforma de Estudio Bíblico</p>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-[var(--color-primary-dark)] mb-1">Usuario</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                required
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent bg-white"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--color-primary-dark)] mb-1">Contraseña</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                required
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)] focus:border-transparent bg-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-gold-dark)] text-white font-bold rounded-md hover:from-[var(--color-gold-light)] hover:to-[var(--color-gold)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-gold)] transition-all flex justify-center items-center"
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-600">¿No tienes cuenta? </span>
          <Link to="/register" className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-light)]">
            Regístrate aquí
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
