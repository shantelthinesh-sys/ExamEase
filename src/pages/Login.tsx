import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button, Card, Spinner } from '@/components/ui';

export default function Login() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { push } = useToast();
  const hintRole = params.get('role');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (profile) {
    navigate(profile.role === 'teacher' ? '/teacher' : '/student', { replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in both fields.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    push('Welcome back!', 'success');
    // profile loads via onAuthStateChange; navigate after a tick
    setTimeout(() => navigate('/'), 300);
  }

  return (
    <AuthShell title="Log in to ExamEase" subtitle={hintRole ? `Logging in as ${hintRole}` : 'Welcome back'}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorBox message={error} />}
        <Field icon={<Mail size={16} />} label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent outline-none" placeholder="you@example.com" autoComplete="email" />
        </Field>
        <Field icon={<Lock size={16} />} label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent outline-none" placeholder="••••••••" autoComplete="current-password" />
        </Field>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Spinner /> : <>Log in <ArrowRight size={16} /></>}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600">
        No account? <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700">Create one</Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-500">
        <Link to="/get-started?demo=1" className="font-medium text-slate-600 hover:text-slate-800">Try the demo instead</Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white"><GraduationCap size={20} /></div>
          <span className="text-lg font-bold">ExamEase</span>
        </Link>
        <Link to="/get-started"><Button variant="ghost" size="sm">Get Started</Button></Link>
      </header>
      <div className="mx-auto max-w-md px-6 py-10">
        <Card className="p-8">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </Card>
      </div>
    </div>
  );
}

export function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <span className="text-slate-400">{icon}</span>
        {children}
      </div>
    </label>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
