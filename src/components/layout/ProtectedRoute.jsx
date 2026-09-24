import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../shared/LoadingSpinner';

export const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center"><LoadingSpinner /></div>;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
};

export const AdminRoute = () => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center"><LoadingSpinner /></div>;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  return <Outlet />;
};
