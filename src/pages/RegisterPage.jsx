import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { User, Lock, Mail } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const RegisterPage = () => {
  const [formData, setFormData] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
      return setError('Las contraseñas no coinciden');
    }
    if (formData.password.length < 6) {
      return setError('La contraseña debe tener al menos 6 caracteres');
    }

    setLoading(true);
    try {
      await register(formData.username, formData.password, formData.email);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-primary-dark)] px-4 py-8">
      <div className="w-full max-w-md bg-[var(--color-parchment)] p-8 rounded-xl shadow-2xl border-2 border-[var(--color-gold)]">
        <div className="text-center mb-8">
          <h1 className="font-cinzel text-3xl font-bold text-[var(--color-primary)] mb-2">Crear Cuenta</h1>
          <p className="text-gray-600 font-medium">
            Únete a {(formData.username !== 'Rowlis' && formData.username !== 'Rangelis') ? 'Remanente Platform' : 'la Plataforma'}
          </p>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--color-primary-dark)] mb-1">Usuario</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className="h-5 w-5 text-gray-400" /></div>
              <input type="text" name="username" required className="w-full pl-10 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-[var(--color-gold)] bg-white" onChange={handleChange} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--color-primary-dark)] mb-1">Correo (Opcional)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-gray-400" /></div>
              <input type="email" name="email" className="w-full pl-10 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-[var(--color-gold)] bg-white" onChange={handleChange} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--color-primary-dark)] mb-1">Contraseña</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
              <input type="password" name="password" required className="w-full pl-10 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-[var(--color-gold)] bg-white" onChange={handleChange} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--color-primary-dark)] mb-1">Confirmar Contraseña</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
              <input type="password" name="confirmPassword" required className="w-full pl-10 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-[var(--color-gold)] bg-white" onChange={handleChange} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 px-4 bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-gold-dark)] text-white font-bold rounded-md hover:opacity-90 flex justify-center items-center mt-6">
            {loading ? <LoadingSpinner size="sm" /> : 'Registrarse'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-600">¿Ya tienes cuenta? </span>
          <Link to="/login" className="font-semibold text-[var(--color-primary)] hover:underline">Inicia sesión</Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
