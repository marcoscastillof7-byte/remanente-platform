import { createContext, useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Efecto para inyectar el tema visual dinámicamente
  useEffect(() => {
    if (user && user.group) {
      document.documentElement.style.setProperty('--color-primary', user.group.primary_color);
      document.documentElement.style.setProperty('--color-gold', user.group.secondary_color);
    } else {
      document.documentElement.style.setProperty('--color-primary', '#1e3a5f');
      document.documentElement.style.setProperty('--color-gold', '#d4af37');
    }
  }, [user]);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const profile = await api.get('/auth/profile');
          setUser(profile);
        } catch (error) {
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (username, password) => {
    const { token, user: userData } = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const register = async (username, password, email, groupId) => {
    const { token, user: userData } = await api.post('/auth/register', { username, password, email, groupId });
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Regla absoluta: Solo Marcos tiene el Súper Panel de MegaAdmin
  const isMarcos = user?.username?.toLowerCase() === 'marcos';
  const isSuperAdmin = isMarcos;
  
  // Si es superAdmin (Marcos), o tiene rol admin, puede ver el Panel Admin normal
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || isMarcos;

  const value = useMemo(() => ({ user, loading, login, register, logout, isAdmin, isSuperAdmin }), [user, loading, isAdmin, isSuperAdmin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
