import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Menu, User, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-[var(--color-primary)] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 mr-2 md:hidden">
              <Menu className="w-6 h-6 text-[var(--color-gold)]" />
            </button>
            <Link to="/" className="flex items-center">
              <span className="font-cinzel text-xl md:text-2xl text-[var(--color-gold)] font-bold">📖 Remanente</span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="hover:text-[var(--color-gold)] transition-colors">Inicio</Link>
            <Link to="/custom-quiz" className="hover:text-[var(--color-gold)] transition-colors">Quiz Personalizado</Link>
            <Link to="/leaderboard" className="hover:text-[var(--color-gold)] transition-colors">Tabla de Honor</Link>
            {isAdmin && (
              <Link to="/admin" className="flex items-center text-[var(--color-gold-light)] hover:text-white transition-colors">
                <Shield className="w-4 h-4 mr-1" />
                Panel Admin
              </Link>
            )}
          </div>

          <div className="flex items-center relative">
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-2 p-2 rounded-md hover:bg-[var(--color-primary-light)] transition-colors"
            >
              <User className="w-5 h-5 text-[var(--color-gold)]" />
              <span className="hidden sm:block text-sm">{user.username}</span>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white text-gray-800 rounded-md shadow-lg py-1 z-50">
                <Link to="/profile" className="block px-4 py-2 text-sm hover:bg-gray-100" onClick={() => setDropdownOpen(false)}>Mi Perfil</Link>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center">
                  <LogOut className="w-4 h-4 mr-2" />
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {menuOpen && (
        <div className="md:hidden bg-[var(--color-primary-dark)] px-2 pt-2 pb-3 space-y-1">
          <Link to="/" className="block px-3 py-2 rounded-md text-base hover:bg-[var(--color-primary-light)] text-white">Inicio</Link>
          <Link to="/custom-quiz" className="block px-3 py-2 rounded-md text-base hover:bg-[var(--color-primary-light)] text-white">Quiz Personalizado</Link>
          <Link to="/leaderboard" className="block px-3 py-2 rounded-md text-base hover:bg-[var(--color-primary-light)] text-white">Tabla de Honor</Link>
          {isAdmin && (
            <Link to="/admin" className="block px-3 py-2 rounded-md text-base text-[var(--color-gold)] hover:bg-[var(--color-primary-light)]">Panel Admin</Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
