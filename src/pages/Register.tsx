import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Building2, GraduationCap, ArrowRight, IdCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Button, Spinner } from '@/components/ui';
import { AuthShell, Field, ErrorBox } from './Login';

export default function Register() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirm: '',
    role: 'student' as 'student' | 'teacher',
    department: '', institution: '', studentId: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.fullName || !form.email || !form.password) { setError('Please fill in all required fields.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName, role: form.role } },
    });
    if (signUpErr) { setLoading(false); setError(signUpErr.message); return; }

    // create profile via RPC (role locked at signup)
    if (data.user) {
      const { error: rpcErr } = await supabase.rpc('upsert_my_profile', {
        p_full_name: form.fullName,
        p_role: form.role,
        p_department: form.department || null,
        p_institution: form.institution || null,
        p_student_id: form.studentId || null,
      });
      if (rpcErr) {
        setLoading(false);
        setError('Account created but profile setup failed: ' + rpcErr.message);
        return;
      }
    }
    setLoading(false);
    push('Account created! You can now log in.', 'success');
    navigate('/login');
  }

  return (
    <AuthShell title="Create your account" subtitle="Join ExamEase as a student or teacher">
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorBox message={error} />}

        <div className="grid grid-cols-2 gap-3">
          <RolePick current={form.role} value="student" label="Student" icon={<GraduationCap size={18} />} onClick={() => set('role', 'student')} />
          <RolePick current={form.role} value="teacher" label="Teacher" icon={<User size={18} />} onClick={() => set('role', 'teacher')} />
        </div>

        <Field icon={<User size={16} />} label="Full name *">
          <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} className="w-full bg-transparent outline-none" placeholder="Jane Doe" />
        </Field>
        <Field icon={<Mail size={16} />} label="Email *">
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="w-full bg-transparent outline-none" placeholder="you@example.com" autoComplete="email" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field icon={<Lock size={16} />} label="Password *">
            <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} className="w-full bg-transparent outline-none" placeholder="••••••••" autoComplete="new-password" />
          </Field>
          <Field icon={<Lock size={16} />} label="Confirm *">
            <input type="password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} className="w-full bg-transparent outline-none" placeholder="••••••••" autoComplete="new-password" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field icon={<Building2 size={16} />} label="Department">
            <input value={form.department} onChange={(e) => set('department', e.target.value)} className="w-full bg-transparent outline-none" placeholder="Computer Science" />
          </Field>
          <Field icon={<Building2 size={16} />} label="Institution">
            <input value={form.institution} onChange={(e) => set('institution', e.target.value)} className="w-full bg-transparent outline-none" placeholder="Your college" />
          </Field>
        </div>
        {form.role === 'student' && (
          <Field icon={<IdCard size={16} />} label="Student ID">
            <input value={form.studentId} onChange={(e) => set('studentId', e.target.value)} className="w-full bg-transparent outline-none" placeholder="Optional" />
          </Field>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Spinner /> : <>Create account <ArrowRight size={16} /></>}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600">
        Already have an account? <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700">Log in</Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-500">
        <Link to="/get-started?demo=1" className="font-medium text-slate-600 hover:text-slate-800">Try the demo instead</Link>
      </p>
    </AuthShell>
  );
}

function RolePick({ current, value, label, icon, onClick }: { current: string; value: string; label: string; icon: React.ReactNode; onClick: () => void }) {
  const active = current === value;
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${active ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
      {icon} {label}
    </button>
  );
}
