import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from '@/lib/supabase';

type DemoProfile = {
  id: string;
  email: string;
  full_name: string;
  role: 'student' | 'teacher';
  department: string | null;
  institution: string | null;
  student_id: string | null;
  isDemo: true;
};

type AuthUser = (User & { profile?: Profile }) | DemoProfile | null;

type AuthContextValue = {
  user: AuthUser;
  profile: Profile | DemoProfile | null;
  session: Session | null;
  loading: boolean;
  isDemo: boolean;
  signOut: () => Promise<void>;
  enterDemo: (role: 'student' | 'teacher') => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_KEY = 'examease_demo_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | DemoProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (data) setProfile(data as Profile);
    else setProfile(null);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      } else {
        // demo?
        const raw = localStorage.getItem(DEMO_KEY);
        if (raw) {
          try {
            setProfile(JSON.parse(raw) as DemoProfile);
          } catch { setProfile(null); }
          } else {
            setProfile(null);
          }
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess);
        if (sess?.user) {
          await loadProfile(sess.user.id);
        } else {
          const raw = localStorage.getItem(DEMO_KEY);
          if (raw) {
            try { setProfile(JSON.parse(raw) as DemoProfile); } catch { setProfile(null); }
          } else {
            setProfile(null);
          }
        }
        setLoading(false);
      })();
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const isDemo = (profile as DemoProfile | null)?.isDemo === true;

  async function signOut() {
    localStorage.removeItem(DEMO_KEY);
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }

  function enterDemo(role: 'student' | 'teacher') {
    const demo: DemoProfile = {
      id: 'demo-' + role,
      email: role === 'student' ? 'demo.student@examease.app' : 'demo.teacher@examease.app',
      full_name: role === 'student' ? 'Demo Student' : 'Demo Teacher',
      role,
      department: role === 'student' ? 'Computer Science' : null,
      institution: 'Demo University',
      student_id: role === 'student' ? 'DEMO-001' : null,
      isDemo: true,
    };
    localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
    setProfile(demo);
    setSession(null);
  }

  async function refreshProfile() {
    if (session?.user) await loadProfile(session.user.id);
  }

  const user: AuthUser = session?.user
    ? { ...session.user, profile: profile && !('isDemo' in profile) ? profile : undefined }
    : (isDemo ? (profile as DemoProfile) : null);

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, isDemo, signOut, enterDemo, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
