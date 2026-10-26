import { useAuth } from '@/context/AuthContext';

// Hook that exposes whether we're in demo mode, so data-fetching components
// can switch between real Supabase queries and the static demo dataset.
export function useDemo() {
  const { isDemo } = useAuth();
  return { isDemo };
}
