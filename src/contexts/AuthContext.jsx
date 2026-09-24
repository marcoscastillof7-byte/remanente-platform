import { createContext, useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const register = async (username, password, email) => {
    const { token, user: userData } = await api.post('/auth/register', { username, password, email });
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';

  const value = useMemo(() => ({ user, loading, login, register, logout, isAdmin }), [user, loading, isAdmin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
