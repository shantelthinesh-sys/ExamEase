import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui';

export function RequireAuth({ role, children }: { role: 'student' | 'teacher'; children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner className="text-blue-600" /></div>;
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.role !== role) return <Navigate to={profile.role === 'teacher' ? '/teacher' : '/student'} replace />;
  return <>{children}</>;
}
